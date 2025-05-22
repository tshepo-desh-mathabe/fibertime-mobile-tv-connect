import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../device/entities/device.entity/device.entity';
import { User } from '../user/entities/user.entity/user.entity';
import { DeviceResponseDto } from './dto/device-response.dto';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { generateAlphanumericCode, calculateExpiryTime } from '../util/calculate.helper';
import { GenericResponsePayload } from '../util/payload/generic-response';
import { ConnectionStatus, GenericConst } from '../util/app.const';
import { ConnectionService } from 'src/connection/connection.service';
import { BundleService } from 'src/bundle/bundle.service';
import { ConnectionResponsePayload } from 'src/util/payload/connection-response';
import { RedisClientType } from 'redis';

@Injectable()
export class DeviceService {
    private readonly logger = new Logger(DeviceService.name);
    private readonly deviceCodeExpiryMinutes: number;
    private readonly bundleExpiryDay: number;

    constructor(
        @InjectRepository(Device)
        private readonly deviceRepository: Repository<Device>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
        private readonly connectionService: ConnectionService,
        private readonly bundleService: BundleService,
        @Inject('REDIS_CLIENT')
        private readonly redisClient: RedisClientType,
    ) {
        this.deviceCodeExpiryMinutes = this.configService.get<number>('DEVICE_CODE_EXPIRY_MINUTES', 5);
        this.bundleExpiryDay = this.configService.get<number>('BUNDLE_EXPIRY_DAYS', 20);
        this.logger.log(`Device code expiry set to ${this.deviceCodeExpiryMinutes} minutes`);
        this.logger.log(`Bundle expriry set to ${this.bundleExpiryDay} days`);
    }

    async getConnectedDevice(deviceCode: string): Promise<ConnectionResponsePayload> {
        const existingDevice = await this.getDeviceByCode(deviceCode);
        const deviceFromDto: Device = {
            id: existingDevice.id,
            code: existingDevice.deviceCode,
            expiresAt: existingDevice.expiresAt,
            createdAt: existingDevice.createdAt,
            phoneNumber: existingDevice.phoneNumber,
        };

        const connection = await this.connectionService.getConnectionByDevice(deviceFromDto);
        const bundle = await this.bundleService.loadActiveBundle(existingDevice.deviceCode);

        return {
            connectedUserPhoneNumber: existingDevice.phoneNumber,
            connectionStatus: connection?.status,
            connectionCreatedAt: connection?.createdAt,
            deviceCode: existingDevice.deviceCode,
            deviceExpiresAt: existingDevice.expiresAt,
            deviceCreatedAt: existingDevice.createdAt,
            bundle: bundle
        }

    }

    /**
     * Generates a new pairing code for TV connection
     */
    async generatePairingCode(): Promise<GenericResponsePayload> {
        this.logger.log('Starting device pairing code generation');
        // await this.cleanupExpiredDevices();

        const code = await this.generateUniqueDeviceCode();
        const expiresAt = calculateExpiryTime(this.deviceCodeExpiryMinutes);
        this.logger.debug(`Generated new device code: ${code}, expires at: ${expiresAt}`);

        await this.createAndCacheDevice(code, expiresAt);

        this.logger.log(`Successfully generated pairing code: ${code}`);
        return { message: code };
    }

    /**
     * Retrieves device information by its code
     */
    async getDeviceByCode(code: string): Promise<DeviceResponseDto> {
        this.logger.log(`Fetching device by code: ${code}`);

        // Validate code format
        if (!this.isValidDeviceCode(code)) {
            this.logger.warn(`Invalid device code format: ${code}`);
            throw new NotFoundException('Invalid device code format');
        }

        // Try cache first
        this.logger.debug(`Checking cache for device code: ${code}`);
        const cachedDevice = await this.getDeviceFromCache(code);
        if (cachedDevice) {
            this.logger.debug(`Device ${code} found in cache`);
            return cachedDevice;
        }

        // Fallback to database
        this.logger.debug(`Device ${code} not in cache, querying database`);
        const device = await this.getDeviceFromDatabase(code);

        // Update cache
        await this.cacheDevice(device);
        this.logger.debug(`Device ${code} cached successfully`);

        return this.toDeviceResponseDto(device);
    }

    /**
     * Connects a device to a user account
     */
    async connectDevice(phoneNumber: string, code: string): Promise<DeviceResponseDto> {
        this.logger.log(`Attempting to connect device ${code} to user ${phoneNumber}`);

        const user = await this.userRepository.findOne({
            where: { phoneNumber }
        });

        if (!user) {
            this.logger.warn(`User not found for phone-number: ${phoneNumber}`);
            throw new NotFoundException('User not found');
        }

        const device = await this.validateAndGetDevice(code);

        // Check if device is already connected
        if (device.phoneNumber !== GenericConst.PHONE_NUMBER_DEFUALT && device.phoneNumber === phoneNumber) {
            this.logger.warn(`Device ${code} already connected to user ${user.id}`);
            throw new ConflictException('Device has a connection to another user');
        }

        // Update device connection
        device.phoneNumber = user.phoneNumber;

        // store device | store new connection | store new
        const storedDevice = await this.deviceRepository.save(device);
        await this.connectionService.createNewConnection(ConnectionStatus.ACTIVE, storedDevice);
        this.logger.log(`Device ${code} connected to user ${user.id}`);
        await this.bundleService.createOrRenewBundle(this.bundleExpiryDay, storedDevice);
        this.logger.log(`Bundle save/updated for device-code ${storedDevice.code}`);

        // Update cache
        await this.cacheDevice(device);
        this.logger.debug(`Updated cache for device ${code}`);

        return this.toDeviceResponseDto(device);
    }

    /**
     * Cleans up expired devices from the database
     */
    private async cleanupExpiredDevices(): Promise<void> {
        this.logger.log('Cleaning up expired devices');
        const result = await this.deviceRepository
            .createQueryBuilder()
            .delete()
            .where('expiresAt < :now', { now: new Date() })
            .execute();

        if (result?.affected && result.affected > 0) {
            this.logger.log(`Cleaned up ${result.affected} expired devices`);
        } else {
            this.logger.debug('No expired devices found to clean up');
        }
    }

    /**
     * Generates a unique device code
     */
    private async generateUniqueDeviceCode(): Promise<string> {
        const MAX_ATTEMPTS = 10;
        let attempts = 0;
        let code: string;
        let exists: Device | null;

        this.logger.debug('Generating unique device code');

        do {
            if (attempts++ >= MAX_ATTEMPTS) {
                this.logger.error('Failed to generate unique device code after maximum attempts');
                throw new Error('Failed to generate unique device code');
            }

            code = generateAlphanumericCode(4);
            exists = await this.deviceRepository.findOne({ where: { code } });
        } while (exists);

        this.logger.debug(`Generated unique code after ${attempts} attempts: ${code}`);
        return code;
    }

    /**
     * Creates a new device and caches it
     */
    private async createAndCacheDevice(code: string, expiresAt: Date): Promise<Device> {
        this.logger.debug(`Creating new device with code: ${code}`);

        const device = this.deviceRepository.create({
            code,
            expiresAt,
            phoneNumber: GenericConst.PHONE_NUMBER_DEFUALT
        });

        await this.deviceRepository.save(device);
        this.logger.debug(`Device ${code} saved to database`);

        await this.cacheDevice(device);
        this.logger.debug(`Device ${code} cached in Redis`);

        return device;
    }

    /**
     * Retrieves device from cache
     */
    private async getDeviceFromCache(code: string): Promise<DeviceResponseDto | null> {
        try {
            const cachedData = await this.redisClient.get(`device:${code}`);
            return cachedData ? JSON.parse(cachedData) : null;
        } catch (error) {
            this.logger.error(`Error reading from cache for device ${code}: ${error.message}`);
            return null;
        }
    }

    /**
     * Retrieves device from database with validation
     */
    private async getDeviceFromDatabase(code: string): Promise<Device> {
        this.logger.debug(`Querying database for device: ${code}`);
        const device = await this.deviceRepository.findOne({ where: { code } });

        if (!device) {
            this.logger.warn(`Device not found in database: ${code}`);
            throw new NotFoundException('Device not found');
        }

        // Update status if expired
        let connectionState = await this.connectionService.getConnectionStatusByDevice(device);
        if (device.expiresAt < new Date() && connectionState !== ConnectionStatus.EXPIRED) {
            this.logger.debug(`Marking expired device: ${code}`);
            connectionState = ConnectionStatus.EXPIRED;
            await this.connectionService.updateConnectionStatus(connectionState, device);
        }

        return device;
    }

    /**
     * Validates and retrieves a device for connection
     */
    private async validateAndGetDevice(code: string): Promise<Device> {
        this.logger.debug(`Validating device: ${code}`);
        const device = await this.getDeviceFromDatabase(code);

        if (device.expiresAt < new Date()) {
            this.logger.warn(`Attempt to use expired device code: ${code}`);
            throw new ConflictException('Device code has expired');
        }

        return device;
    }

    /**
     * Caches device information
     */
    private async cacheDevice(device: Device): Promise<void> {
        const ttl = Math.floor((device.expiresAt.getTime() - Date.now()) / 1000);

        if (ttl > 0) {
            try {
                await this.redisClient.setEx(
                    `device:${device.code}`,
                    ttl,
                    JSON.stringify(this.toDeviceResponseDto(device))
                );
                this.logger.debug(`Cached device ${device.code} with TTL ${ttl} seconds`);
            } catch (error) {
                this.logger.error(`Failed to cache device ${device.code}: ${error.message}`);
            }
        } else {
            this.logger.warn(`Not caching device ${device.code} with expired or negative TTL`);
        }
    }

    /**
     * Converts Device entity to DTO
     */
    private toDeviceResponseDto(device: Device): DeviceResponseDto {
        return {
            id: device.id,
            deviceCode: device.code,
            expiresAt: device.expiresAt,
            createdAt: device.createdAt,
            phoneNumber: device.phoneNumber,
        };
    }

    /**
     * Validates device code format
     */
    private isValidDeviceCode(code: string): boolean {
        const isValid = /^[A-Z0-9]{4}$/.test(code);
        if (!isValid) {
            this.logger.debug(`Invalid device code format: ${code}`);
        }
        return isValid;
    }
}