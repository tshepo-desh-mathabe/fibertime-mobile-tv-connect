import { Injectable, Inject } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
    constructor(
        // Injects the Redis client instance registered in the RedisModule
        @Inject('REDIS_CLIENT') private readonly redisClient: RedisClientType,
    ) { }

    /**
     * Retrieves the value of a key from Redis.
     * @param key - The key to retrieve.
     * @returns The value as a string or null if not found.
     */
    async get(key: string): Promise<string | null> {
        return this.redisClient.get(key);
    }

    /**
     * Sets a key-value pair in Redis, optionally with a time-to-live (TTL).
     * @param key - The key to set.
     * @param value - The value to store.
     * @param ttl - Optional TTL in seconds.
     */
    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.redisClient.setEx(key, ttl, value); // Set with expiration
        } else {
            await this.redisClient.set(key, value); // Set without expiration
        }
    }

    /**
     * Deletes a key from Redis.
     * @param key - The key to delete.
     */
    async del(key: string): Promise<void> {
        await this.redisClient.del(key);
    }

    /**
     * Increments the integer value of a key by one.
     * @param key - The key to increment.
     * @returns The new value after increment.
     */
    async incr(key: string): Promise<number> {
        return this.redisClient.incr(key);
    }

    /**
     * Sets a TTL (time-to-live) in seconds on an existing key.
     * @param key - The key to expire.
     * @param seconds - The TTL in seconds.
     */
    async expire(key: string, seconds: number): Promise<void> {
        await this.redisClient.expire(key, seconds);
    }
}
