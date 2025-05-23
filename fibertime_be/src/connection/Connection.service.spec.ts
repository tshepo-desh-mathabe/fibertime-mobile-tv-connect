import { Test, TestingModule } from '@nestjs/testing';
import { ConnectionService } from './connection.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Connection } from './entities/connection.entity/connection.entity';
import { Device } from '../device/entities/device.entity/device.entity';
import { Logger } from '@nestjs/common';
import { ConnectionStatus, ConnectionStatusType } from '../util/app.const';

jest.mock('redis');

describe('ConnectionService', () => {
  let connectionService: ConnectionService;
  let connectionRepository: Repository<Connection>;
  let redisClient: any;

  const mockRedisClient = {
    get: jest.fn(),
    setEx: jest.fn(),
  };

  const mockDevice: Device = {
    id: '1',
    code: 'DEVICE123',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    phoneNumber: '1234567890',
  };

  const mockConnection: Connection = {
    id: 1,
    status: ConnectionStatus.ACTIVE,
    device: mockDevice,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectionService,
        {
          provide: getRepositoryToken(Connection),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisClient,
        },
        Logger,
      ],
    }).compile();

    connectionService = module.get<ConnectionService>(ConnectionService);
    connectionRepository = module.get<Repository<Connection>>(getRepositoryToken(Connection));
    redisClient = module.get('REDIS_CLIENT');

    // Spy on Logger methods
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConnectionByDevice', () => {
    it('should return cached connection if available', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(mockConnection));
      const result = await connectionService.getConnectionByDevice(mockDevice);

      expect(redisClient.get).toHaveBeenCalledWith(`connection:full:${mockDevice.code}`);
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        status: ConnectionStatus.ACTIVE,
        device: expect.objectContaining({ id: '1', code: 'DEVICE123' }),
      }));
      expect(connectionRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in Redis', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue(null);
      jest.spyOn(connectionRepository, 'findOne').mockResolvedValue(mockConnection);
      jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

      const result = await connectionService.getConnectionByDevice(mockDevice);

      expect(redisClient.get).toHaveBeenCalledWith(`connection:full:${mockDevice.code}`);
      expect(connectionRepository.findOne).toHaveBeenCalledWith({
        where: { device: { id: mockDevice.id } },
        relations: ['device'],
        order: { createdAt: 'DESC' },
      });
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `connection:full:${mockDevice.code}`,
        300,
        JSON.stringify(mockConnection),
      );
      expect(result).toEqual(expect.objectContaining({
        id: 1,
        status: ConnectionStatus.ACTIVE,
      }));
    });

    it('should return null if no connection exists', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue(null);
      jest.spyOn(connectionRepository, 'findOne').mockResolvedValue(null);

      const result = await connectionService.getConnectionByDevice(mockDevice);

      expect(redisClient.get).toHaveBeenCalled();
      expect(connectionRepository.findOne).toHaveBeenCalled();
      expect(redisClient.setEx).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle Redis error and fetch from database', async () => {
      jest.spyOn(redisClient, 'get').mockRejectedValue(new Error('Redis error'));
      jest.spyOn(connectionRepository, 'findOne').mockResolvedValue(mockConnection);
      jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

      const result = await connectionService.getConnectionByDevice(mockDevice);

      expect(Logger.prototype.error).toHaveBeenCalledWith('Redis cache error: Redis error');
      expect(connectionRepository.findOne).toHaveBeenCalled();
      expect(redisClient.setEx).toHaveBeenCalled();
      expect(result).toEqual(mockConnection);
    });

    it('should handle database error and return null', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue(null);
      jest.spyOn(connectionRepository, 'findOne').mockRejectedValue(new Error('DB error'));

      const result = await connectionService.getConnectionByDevice(mockDevice);

      expect(Logger.prototype.error).toHaveBeenCalledWith('Database error fetching connection: DB error');
      expect(result).toBeNull();
    });
  });

  describe('getConnectionStatusByDevice', () => {
    it('should return cached status if valid', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue(ConnectionStatus.ACTIVE);

      const result = await connectionService.getConnectionStatusByDevice(mockDevice);

      expect(redisClient.get).toHaveBeenCalledWith(`connection:${mockDevice.code}`);
      expect(result).toBe(ConnectionStatus.ACTIVE);
      expect(connectionRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database if cache is empty and cache result', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue(null);
      jest.spyOn(connectionRepository, 'findOne').mockResolvedValue(mockConnection);
      jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

      const result = await connectionService.getConnectionStatusByDevice(mockDevice);

      expect(redisClient.get).toHaveBeenCalledWith(`connection:${mockDevice.code}`);
      expect(connectionRepository.findOne).toHaveBeenCalledWith({
        where: { device: { id: mockDevice.id } },
        select: ['status'],
        order: { createdAt: 'DESC' },
      });
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `connection:${mockDevice.code}`,
        300,
        ConnectionStatus.ACTIVE,
      );
      expect(result).toBe(ConnectionStatus.ACTIVE);
    });

    it('should return undefined if no connection exists', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue(null);
      jest.spyOn(connectionRepository, 'findOne').mockResolvedValue(null);

      const result = await connectionService.getConnectionStatusByDevice(mockDevice);

      expect(redisClient.get).toHaveBeenCalled();
      expect(connectionRepository.findOne).toHaveBeenCalled();
      expect(redisClient.setEx).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should fetch from database if cached status is invalid', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue('invalid');
      jest.spyOn(connectionRepository, 'findOne').mockResolvedValue(mockConnection);
      jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

      const result = await connectionService.getConnectionStatusByDevice(mockDevice);

      expect(connectionRepository.findOne).toHaveBeenCalled();
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `connection:${mockDevice.code}`,
        300,
        ConnectionStatus.ACTIVE,
      );
      expect(result).toBe(ConnectionStatus.ACTIVE);
    });

    it('should handle database error and return undefined', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue(null);
      jest.spyOn(connectionRepository, 'findOne').mockRejectedValue(new Error('DB error'));

      const result = await connectionService.getConnectionStatusByDevice(mockDevice);

      expect(Logger.prototype.warn).toHaveBeenCalledWith('Error fetching connection status: DB error');
      expect(result).toBeUndefined();
    });
  });

  describe('createNewConnection', () => {
    it('should create and save a new connection with valid status', async () => {
      jest.spyOn(connectionRepository, 'create').mockReturnValue(mockConnection);
      jest.spyOn(connectionRepository, 'save').mockResolvedValue(mockConnection);
      jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

      const result = await connectionService.createNewConnection(ConnectionStatus.ACTIVE, mockDevice);

      expect(connectionRepository.create).toHaveBeenCalledWith({
        status: ConnectionStatus.ACTIVE,
        device: mockDevice,
        createdAt: expect.any(Date),
      });
      expect(connectionRepository.save).toHaveBeenCalledWith(mockConnection);
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `connection:${mockDevice.code}`,
        300,
        ConnectionStatus.ACTIVE,
      );
      expect(result).toEqual(mockConnection);
    });

    it('should throw error for invalid status', async () => {
      await expect(
        connectionService.createNewConnection('invalid' as ConnectionStatusType, mockDevice),
      ).rejects.toThrow(
        `Invalid status value. Must be one of: ${Object.values(ConnectionStatus).join(', ')}`,
      );
      expect(Logger.prototype.warn).toHaveBeenCalledWith('Invalid status: invalid');
      expect(connectionRepository.create).not.toHaveBeenCalled();
      expect(redisClient.setEx).not.toHaveBeenCalled();
    });
  });

  describe('updateConnectionStatus', () => {
    it('should update status and cache for existing connection', async () => {
      jest.spyOn(connectionRepository, 'update').mockResolvedValue({ affected: 1 } as any);
      jest.spyOn(redisClient, 'setEx').mockResolvedValue(undefined);

      await connectionService.updateConnectionStatus(ConnectionStatus.EXPIRED, mockDevice);

      expect(connectionRepository.update).toHaveBeenCalledWith(
        { device: { id: mockDevice.id } },
        { status: ConnectionStatus.EXPIRED },
      );
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `connection:${mockDevice.code}`,
        300,
        ConnectionStatus.EXPIRED,
      );
    });

    it('should throw error if no connection exists', async () => {
      jest.spyOn(connectionRepository, 'update').mockResolvedValue({ affected: 0 } as any);

      await expect(
        connectionService.updateConnectionStatus(ConnectionStatus.EXPIRED, mockDevice),
      ).rejects.toThrow(`Connection not found for device ${mockDevice.id}`);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(`No connection found for device: ${mockDevice.id}`);
      expect(redisClient.setEx).not.toHaveBeenCalled();
    });

    it('should throw error for invalid status', async () => {
      await expect(
        connectionService.updateConnectionStatus('invalid' as ConnectionStatusType, mockDevice),
      ).rejects.toThrow(
        `Invalid status value. Must be one of: ${Object.values(ConnectionStatus).join(', ')}`,
      );
      expect(Logger.prototype.warn).toHaveBeenCalledWith('Invalid status: invalid');
      expect(connectionRepository.update).not.toHaveBeenCalled();
      expect(redisClient.setEx).not.toHaveBeenCalled();
    });
  });
});