import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bundle } from '../bundle/entities/bundle.entity/bundle.entity';
import { Device } from '../device/entities/device.entity/device.entity';
import { UserBundleDto } from './dto/user-bundle.dto/user-bundle.dto';
import { RedisClientType } from 'redis';

@Injectable()
export class BundleService {
  private readonly logger = new Logger(BundleService.name);
  private readonly CACHE_TTL = 3600; // 1 hour cache TTL

  constructor(
    @InjectRepository(Bundle)
    private readonly bundleRepository: Repository<Bundle>,
    @Inject('REDIS_CLIENT')
    private readonly redisClient: RedisClientType
  ) { }

  /**
   * Creates or renews a bundle with caching
   */
  async createOrRenewBundle(days: number, device: Device): Promise<Bundle | undefined> {
    if (!device) {
      this.logger.warn('Device not found');
      throw new Error('Device not found');
    }

    try {
      // Check cache first
      const cachedBundle = await this.getCachedBundle(device.code);
      if (cachedBundle) {
        this.logger.debug(`Using cached bundle for device ${device.code}`);
        return cachedBundle;
      }

      const existingBundle = await this.getActiveBundle(device.code);
      let updatedBundle: Bundle | null;

      if (existingBundle) {
        const expiresAt = new Date(existingBundle.expiresAt);
        expiresAt.setDate(expiresAt.getDate() + days);

        await this.bundleRepository.update(existingBundle.id, {
          expiresAt,
          remainingDays: days
        });

        updatedBundle = await this.bundleRepository.findOneBy({ id: existingBundle.id });

      } else {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);

        updatedBundle = this.bundleRepository.create({
          device,
          expiresAt,
          remainingDays: days
        });

        await this.bundleRepository.save(updatedBundle);
      }

      // Update cache
      if (updatedBundle !== null) {
        await this.cacheBundle(device.code, updatedBundle);
        return updatedBundle;
      }
    } catch (error) {
      this.logger.error(`Error in createOrRenewBundle: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets active bundle with caching
   */
  async loadActiveBundle(deviceCode: string): Promise<UserBundleDto | null> {
    try {
      // Try cache first
      const cachedStatus = await this.redisClient.get(`bundle:status:${deviceCode}`);
      if (cachedStatus) {
        this.logger.debug(`Returning cached bundle status for ${deviceCode}`);
        return JSON.parse(cachedStatus);
      }

      const bundle = await this.getActiveBundle(deviceCode);
      if (!bundle) return null;

      const status = this.calculateRemainingTime(bundle);

      // Cache the status
      if (status) {
        await this.redisClient.setEx(
          `bundle:status:${deviceCode}`,
          this.CACHE_TTL,
          JSON.stringify(status)
        );
      }

      return status;
    } catch (error) {
      this.logger.error(`Error in loadActiveBundle: ${error.message}`);
      return null;
    }
  }

  /**
   * Cache management methods
   */
  private async getCachedBundle(deviceCode: string): Promise<Bundle | null> {
    try {
      const cached = await this.redisClient.get(`bundle:${deviceCode}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error(`Cache read error: ${error.message}`);
      return null;
    }
  }

  private async cacheBundle(deviceCode: string, bundle: Bundle): Promise<void> {
    try {
      await this.redisClient.setEx(
        `bundle:${deviceCode}`,
        this.CACHE_TTL,
        JSON.stringify(bundle)
      );
    } catch (error) {
      this.logger.error(`Cache write error: ${error.message}`);
    }
  }

  /**
   * Bundle calculation methods (unchanged)
   */
  private calculateRemainingTime(bundle: Bundle): UserBundleDto | null {
    if (!bundle) {
      this.logger.log('No active bundles found');
      return null;
    }

    if (!bundle.expiresAt || isNaN(bundle.expiresAt.getTime())) {
      this.logger.warn('Invalid expiration date');
      return null;
    }

    const now = new Date();
    const diffMs = bundle.expiresAt.getTime() - now.getTime();

    if (diffMs <= 0) {
      this.logger.log(`Bundle expired at ${bundle.expiresAt}`);
      return {
        expiresAt: bundle.expiresAt,
        remainingDays: 0,
        remainingHours: 0,
        isValid: false
      };
    }

    return {
      expiresAt: bundle.expiresAt,
      remainingDays: bundle.remainingDays - now.getDay(),
      remainingHours: Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      isValid: true
    };
  }

  private async getActiveBundle(deviceCode: string): Promise<Bundle | null> {
    return this.bundleRepository
      .createQueryBuilder('bundle')
      .leftJoinAndSelect('bundle.device', 'device')
      .where('device.code = :code', { code: deviceCode })
      .orderBy('bundle.expiresAt', 'DESC')
      .getOne();
  }
}