import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from 'src/device/entities/device.entity/device.entity';
import { Inject } from '@nestjs/common/decorators';
import { ConnectionStatus, ConnectionStatusType } from '../util/app.const';
import { Connection } from './entities/connection.entity/connection.entity';
import { RedisClientType } from 'redis';

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);

  constructor(
    @InjectRepository(Connection)
    private readonly connectionRepository: Repository<Connection>,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: RedisClientType,
  ) { }

  async getConnectionByDevice(device: Device): Promise<Connection | null> {
    // 1. First try Redis cache
    const cacheKey = `connection:full:${device.code}`;
    try {
      const cachedConnection = await this.redisClient.get(cacheKey);
      if (cachedConnection) {
        return JSON.parse(cachedConnection) as Connection;
      }
    } catch (error) {
      this.logger.error(`Redis cache error: ${error.message}`);
    }

    // 2. Query database if not in cache
    try {
      const connection = await this.connectionRepository.findOne({
        where: { device: { id: device.id } },
        relations: ['device'], // Include device relation if needed
        order: { createdAt: 'DESC' }
      });

      // 3. Cache the result if found
      if (connection) {
        await this.redisClient.setEx(
          cacheKey,
          300, // 5 minutes TTL
          JSON.stringify(connection)
        );
      }

      return connection || null;
    } catch (error) {
      this.logger.error(`Database error fetching connection: ${error.message}`);
      return null;
    }
  }

  async getConnectionStatusByDevice(device: Device): Promise<ConnectionStatusType> {
    // 1. First check Redis cache for quick response
    const cachedStatus = await this.redisClient.get(`connection:${device.code}`);
    if (cachedStatus && this.isValidStatus(cachedStatus as ConnectionStatusType)) {
      return cachedStatus as ConnectionStatusType;
    }

    // 2. If not in cache or invalid, check database
    let connection;
    try {
      connection = await this.connectionRepository.findOne({
        where: { device: { id: device.id } },
        select: ['status'],
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.warn(`Error fetching connection status: ${error.message}`);
    }

    // 3. Determine status
    const status = connection?.status;

    // 4. Update cache if valid status
    if (status && this.isValidStatus(status)) {
      await this.redisClient.setEx(
        `connection:${device.code}`,
        300, // Cache for 5 minutes
        status
      );
    }

    return status;
  }

  async createNewConnection(status: ConnectionStatusType, device: Device): Promise<Connection> {
    this.validateStatus(status);

    const connection = this.connectionRepository.create({
      status,
      device,
      createdAt: new Date()
    });

    // Update cache
    await this.redisClient.setEx(
      `connection:${device.code}`,
      300,
      status
    );

    return this.connectionRepository.save(connection);
  }

  async updateConnectionStatus(status: ConnectionStatusType, device: Device): Promise<void> {
    this.validateStatus(status);

    const result = await this.connectionRepository.update(
      { device: { id: device.id } },
      { status }
    );

    if (result.affected === 0) {
      this.logger.warn(`No connection found for device: ${device.id}`);
      throw new Error(`Connection not found for device ${device.id}`);
    }

    // Update cache
    await this.redisClient.setEx(
      `connection:${device.code}`,
      300,
      status
    );
  }

  private validateStatus(status: ConnectionStatusType): void {
    const validStatuses = Object.values(ConnectionStatus);
    if (!validStatuses.includes(status)) {
      this.logger.warn(`Invalid status: ${status}`);
      throw new Error(`Invalid status value. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  private isValidStatus(status: string): status is ConnectionStatusType {
    return Object.values(ConnectionStatus).includes(status as ConnectionStatusType);
  }
}