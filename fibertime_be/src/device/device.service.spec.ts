import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from './device.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Device } from '../device/entities/device.entity/device.entity';
import { User } from '../user/entities/user.entity/user.entity';
import { ConfigService } from '@nestjs/config';
import { ConnectionService } from '../connection/connection.service';
import { BundleService } from '../bundle/bundle.service';
import { Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { ConnectionStatus, GenericConst } from '../util/app.const';
import { DeviceResponseDto } from './dto/device-response.dto';
import { UserBundleDto } from '../bundle/dto/user-bundle.dto/user-bundle.dto';
import { Bundle } from '../bundle/entities/bundle.entity/bundle.entity';
import * as calculateHelper from '../util/calculate.helper';

jest.mock('redis');
jest.mock('../util/calculate.helper');

describe('DeviceService', () => {
    let deviceService: DeviceService;
    let deviceRepository: Repository<Device>;
    let userRepository: Repository<User>;
    let connectionService: ConnectionService;
    let bundleService: BundleService;
    let redisClient: any;
    let configService: ConfigService;

    const mockRedisClient = {
        get: jest.fn(),
        setEx: jest.fn(),
    };

    const mockDevice: Device = {
        id: '1',
        code: 'ABCD',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        createdAt: new Date(),
        phoneNumber: GenericConst.PHONE_NUMBER_DEFUALT,
    };

    const mockDeviceResponseDto: DeviceResponseDto = {
        id: '1',
        deviceCode: 'ABCD',
        expiresAt: mockDevice.expiresAt,
        createdAt: mockDevice.createdAt,
        phoneNumber: GenericConst.PHONE_NUMBER_DEFUALT,
    };

    const mockUser: User = {
        id: 'user1',
        phoneNumber: '1234567890',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockConnection = {
        id: 1,
        status: ConnectionStatus.ACTIVE,
        device: mockDevice,
        createdAt: new Date(),
    };

    const mockBundle: Bundle = {
        id: 1,
        device: mockDevice,
        expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        remainingDays: 20,
        createdAt: new Date(),
    };

    const mockUserBundleDto: UserBundleDto = {
        expiresAt: mockBundle.expiresAt,
        remainingDays: 20,
        remainingHours: 0,
        isValid: true,
    };

    const mockConfigService = {
        get: jest.fn().mockImplementation((key: string, defaultValue: number) => defaultValue),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeviceService,
                {
                    provide: getRepositoryToken(Device),
                    useValue: {
                        findOne: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                        createQueryBuilder: jest.fn().mockReturnValue({
                            delete: jest.fn().mockReturnThis(),
                            where: jest.fn().mockReturnThis(),
                            execute: jest.fn(),
                        }),
                    },
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: {
                        findOne: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: ConnectionService,
                    useValue: {
                        getConnectionByDevice: jest.fn(),
                        createNewConnection: jest.fn(),
                        getConnectionStatusByDevice: jest.fn(),
                        updateConnectionStatus: jest.fn(),
                    },
                },
                {
                    provide: BundleService,
                    useValue: {
                        loadActiveBundle: jest.fn(),
                        createOrRenewBundle: jest.fn(),
                    },
                },
                {
                    provide: 'REDIS_CLIENT',
                    useValue: mockRedisClient,
                },
                Logger,
            ],
        }).compile();

        deviceService = module.get<DeviceService>(DeviceService);
        deviceRepository = module.get<Repository<Device>>(getRepositoryToken(Device));
        userRepository = module.get<Repository<User>>(getRepositoryToken(User));
        connectionService = module.get<ConnectionService>(ConnectionService);
        bundleService = module.get<BundleService>(BundleService);
        redisClient = module.get('REDIS_CLIENT');
        configService = module.get<ConfigService>(ConfigService);

        // Spy on Logger methods
        jest.spyOn(Logger.prototype, 'log').mockImplementation();
        jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        jest.spyOn(Logger.prototype, 'error').mockImplementation();

        // Mock config values
        mockConfigService.get
            .mockReturnValueOnce(5) // DEVICE_CODE_EXPIRY_MINUTES
            .mockReturnValueOnce(20); // BUNDLE_EXPIRY_DAYS
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getConnectedDevice', () => {
        it('should return connection details for a valid device code', async () => {
            jest.spyOn(deviceService, 'getDeviceByCode').mockResolvedValue(mockDeviceResponseDto);
            jest.spyOn(connectionService, 'getConnectionByDevice').mockResolvedValue(mockConnection);
            jest.spyOn(bundleService, 'loadActiveBundle').mockResolvedValue(mockUserBundleDto);

            const result = await deviceService.getConnectedDevice('ABCD');

            expect(deviceService.getDeviceByCode).toHaveBeenCalledWith('ABCD');
            expect(connectionService.getConnectionByDevice).toHaveBeenCalledWith(expect.objectContaining({ id: '1', code: 'ABCD' }));
            expect(bundleService.loadActiveBundle).toHaveBeenCalledWith('ABCD');
            expect(result).toEqual({
                connectedUserPhoneNumber: mockDeviceResponseDto.phoneNumber,
                connectionStatus: mockConnection.status,
                connectionCreatedAt: mockConnection.createdAt,
                deviceCode: mockDeviceResponseDto.deviceCode,
                deviceExpiresAt: mockDeviceResponseDto.expiresAt,
                deviceCreatedAt: mockDeviceResponseDto.createdAt,
                bundle: mockUserBundleDto,
            });
        });

        it('should throw NotFoundException if device is not found', async () => {
            jest.spyOn(deviceService, 'getDeviceByCode').mockRejectedValue(new NotFoundException('Device not found'));

            await expect(deviceService.getConnectedDevice('ABCD')).rejects.toThrow(NotFoundException);
            expect(connectionService.getConnectionByDevice).not.toHaveBeenCalled();
            expect(bundleService.loadActiveBundle).not.toHaveBeenCalled();
        });
    });

    describe('generatePairingCode', () => {
        it('should generate and return a unique pairing code', async () => {
            jest.spyOn(calculateHelper, 'generateAlphanumericCode').mockReturnValue('ABCD');
            jest.spyOn(calculateHelper, 'calculateExpiryTime').mockReturnValue(mockDevice.expiresAt);
            jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(null);
            jest.spyOn(deviceRepository, 'create').mockReturnValue(mockDevice);
            jest.spyOn(deviceRepository, 'save').mockResolvedValue(mockDevice);
            jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

            const result = await deviceService.generatePairingCode();

            expect(calculateHelper.generateAlphanumericCode).toHaveBeenCalledWith(4);
            expect(deviceRepository.findOne).toHaveBeenCalledWith({ where: { code: 'ABCD' } });
            expect(deviceRepository.create).toHaveBeenCalledWith({
                code: 'ABCD',
                expiresAt: mockDevice.expiresAt,
                phoneNumber: GenericConst.PHONE_NUMBER_DEFUALT,
            });
            expect(deviceRepository.save).toHaveBeenCalledWith(mockDevice);
            expect(redisClient.setEx).toHaveBeenCalledWith(
                `device:ABCD`,
                expect.any(Number),
                JSON.stringify(mockDeviceResponseDto),
            );
            expect(result).toEqual({ message: 'ABCD' });
        });

        it('should throw error if max attempts reached for unique code', async () => {
            jest.spyOn(calculateHelper, 'generateAlphanumericCode').mockReturnValue('ABCD');
            jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(mockDevice); // Simulate existing code

            await expect(deviceService.generatePairingCode()).rejects.toThrow('Failed to generate unique device code');
            expect(Logger.prototype.error).toHaveBeenCalledWith('Failed to generate unique device code after maximum attempts');
        });
    });

    describe('getDeviceByCode', () => {
        it('should return device from cache if available', async () => {
            jest.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(mockDeviceResponseDto));

            const result = await deviceService.getDeviceByCode('ABCD');

            expect(redisClient.get).toHaveBeenCalledWith('device:ABCD');
            expect(deviceRepository.findOne).not.toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({
                id: mockDeviceResponseDto.id,
                deviceCode: mockDeviceResponseDto.deviceCode,
                phoneNumber: mockDeviceResponseDto.phoneNumber,
            }));
        });

        it('should fetch from database and cache if not in Redis', async () => {
            jest.spyOn(redisClient, 'get').mockResolvedValue(null);
            jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(mockDevice);
            jest.spyOn(connectionService, 'getConnectionStatusByDevice').mockResolvedValue(ConnectionStatus.ACTIVE);
            jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

            const result = await deviceService.getDeviceByCode('ABCD');

            expect(redisClient.get).toHaveBeenCalledWith('device:ABCD');
            expect(deviceRepository.findOne).toHaveBeenCalledWith({ where: { code: 'ABCD' } });
            expect(redisClient.setEx).toHaveBeenCalledWith(
                `device:ABCD`,
                expect.any(Number),
                JSON.stringify(mockDeviceResponseDto),
            );
            expect(result).toEqual(expect.objectContaining({
                id: mockDeviceResponseDto.id,
                deviceCode: mockDeviceResponseDto.deviceCode,
                phoneNumber: mockDeviceResponseDto.phoneNumber,
            }));
        });

        it('should update status to EXPIRED if device is expired', async () => {
            const expiredDevice = { ...mockDevice, expiresAt: new Date(Date.now() - 1000) };
            jest.spyOn(redisClient, 'get').mockResolvedValue(null);
            jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(expiredDevice);
            jest.spyOn(connectionService, 'getConnectionStatusByDevice').mockResolvedValue(ConnectionStatus.ACTIVE);
            jest.spyOn(connectionService, 'updateConnectionStatus').mockResolvedValue(undefined);
            jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

            const result = await deviceService.getDeviceByCode('ABCD');

            expect(connectionService.updateConnectionStatus).toHaveBeenCalledWith(ConnectionStatus.EXPIRED, expiredDevice);
            expect(result).toEqual(expect.objectContaining({
                id: mockDeviceResponseDto.id,
                deviceCode: mockDeviceResponseDto.deviceCode,
                expiresAt: expiredDevice.expiresAt,
                phoneNumber: mockDeviceResponseDto.phoneNumber,
            }));
        });

        it('should throw NotFoundException for invalid code format', async () => {
            await expect(deviceService.getDeviceByCode('abc')).rejects.toThrow('Invalid device code format');
            expect(Logger.prototype.warn).toHaveBeenCalledWith('Invalid device code format: abc');
            expect(redisClient.get).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException if device not found', async () => {
            jest.spyOn(redisClient, 'get').mockResolvedValue(null);
            jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(null);

            await expect(deviceService.getDeviceByCode('ABCD')).rejects.toThrow('Device not found');
            expect(Logger.prototype.warn).toHaveBeenCalledWith('Device not found in database: ABCD');
        });

        it('should handle cache read error and fetch from database', async () => {
            jest.spyOn(redisClient, 'get').mockRejectedValue(new Error('Cache error'));
            jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(mockDevice);
            jest.spyOn(connectionService, 'getConnectionStatusByDevice').mockResolvedValue(ConnectionStatus.ACTIVE);
            jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

            const result = await deviceService.getDeviceByCode('ABCD');

            expect(Logger.prototype.error).toHaveBeenCalledWith('Error reading from cache for device ABCD: Cache error');
            expect(deviceRepository.findOne).toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({
                id: mockDeviceResponseDto.id,
                deviceCode: mockDeviceResponseDto.deviceCode,
                phoneNumber: mockDeviceResponseDto.phoneNumber,
            }));
        });
    });

    describe('connectDevice', () => {
        it('should connect device to user and create connection and bundle', async () => {
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser);
            jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(mockDevice);
            jest.spyOn(deviceRepository, 'save').mockResolvedValue({ ...mockDevice, phoneNumber: mockUser.phoneNumber });
            jest.spyOn(connectionService, 'createNewConnection').mockResolvedValue(mockConnection);
            jest.spyOn(bundleService, 'createOrRenewBundle').mockResolvedValue(mockBundle);
            jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);
            jest.spyOn(connectionService, 'getConnectionStatusByDevice').mockResolvedValue(ConnectionStatus.ACTIVE);

            const result = await deviceService.connectDevice(mockUser.phoneNumber, 'ABCD');

            expect(userRepository.findOne).toHaveBeenCalledWith({ where: { phoneNumber: mockUser.phoneNumber } });
            expect(deviceRepository.save).toHaveBeenCalledWith(expect.objectContaining({ phoneNumber: mockUser.phoneNumber }));
            expect(connectionService.createNewConnection).toHaveBeenCalledWith(ConnectionStatus.ACTIVE, expect.any(Object));
            expect(bundleService.createOrRenewBundle).toHaveBeenCalledWith(20, expect.any(Object));
            expect(redisClient.setEx).toHaveBeenCalledWith(
                `device:ABCD`,
                expect.any(Number),
                JSON.stringify({ ...mockDeviceResponseDto, phoneNumber: mockUser.phoneNumber }),
            );
            expect(result).toEqual({ ...mockDeviceResponseDto, phoneNumber: mockUser.phoneNumber });
        });

        it('should throw NotFoundException if user not found', async () => {
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

            await expect(deviceService.connectDevice('1234567890', 'ABCD')).rejects.toThrow('User not found');
            expect(Logger.prototype.warn).toHaveBeenCalledWith('User not found for phone-number: 1234567890');
            expect(deviceRepository.findOne).not.toHaveBeenCalled();
        });

        it('should throw ConflictException if device is already connected to another user', async () => {
            const connectedDevice = { ...mockDevice, phoneNumber: '1234567890' };
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser);
            jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(connectedDevice);
            jest.spyOn(connectionService, 'getConnectionStatusByDevice').mockResolvedValue(ConnectionStatus.ACTIVE);
          
            await expect(deviceService.connectDevice(mockUser.phoneNumber, 'ABCD')).rejects.toThrow(
              'Device has a connection to another user',
            );
            expect(Logger.prototype.warn).toHaveBeenCalledWith(`Device ABCD already connected to user ${mockUser.id}`);
            expect(deviceRepository.save).not.toHaveBeenCalled();
            expect(connectionService.createNewConnection).not.toHaveBeenCalled();
            expect(bundleService.createOrRenewBundle).not.toHaveBeenCalled();
          });

        it('should throw ConflictException if device code is expired', async () => {
            const expiredDevice = { ...mockDevice, expiresAt: new Date(Date.now() - 1000) };
            jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser);
            jest.spyOn(deviceRepository, 'findOne').mockResolvedValue(expiredDevice);
            jest.spyOn(connectionService, 'getConnectionStatusByDevice').mockResolvedValue(ConnectionStatus.ACTIVE);

            await expect(deviceService.connectDevice(mockUser.phoneNumber, 'ABCD')).rejects.toThrow('Device code has expired');
            expect(Logger.prototype.warn).toHaveBeenCalledWith('Attempt to use expired device code: ABCD');
            expect(deviceRepository.save).not.toHaveBeenCalled();
            expect(connectionService.createNewConnection).not.toHaveBeenCalled();
            expect(bundleService.createOrRenewBundle).not.toHaveBeenCalled();
        });
    });

    describe('cleanupExpiredDevices', () => {
        it('should delete expired devices and log the result', async () => {
            jest.spyOn(deviceRepository, 'createQueryBuilder').mockReturnValue({
                delete: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: 2 }),
            } as any);

            await (deviceService as any).cleanupExpiredDevices();

            expect(deviceRepository.createQueryBuilder).toHaveBeenCalled();
            expect(Logger.prototype.log).toHaveBeenCalledWith('Cleaned up 2 expired devices');
        });

        it('should log when no expired devices are found', async () => {
            jest.spyOn(deviceRepository, 'createQueryBuilder').mockReturnValue({
                delete: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: 0 }),
            } as any);

            await (deviceService as any).cleanupExpiredDevices();

            expect(Logger.prototype.log).toHaveBeenCalledWith('Cleaning up expired devices');
            expect(Logger.prototype.debug).toHaveBeenCalledWith('No expired devices found to clean up');
        });
    });
});