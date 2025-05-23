import { Test, TestingModule } from '@nestjs/testing';
import { BundleService } from './bundle.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Bundle } from './entities/bundle.entity/bundle.entity';
import { Device } from '../device/entities/device.entity/device.entity';
import { Repository } from 'typeorm';

describe('BundleService', () => {
    let service: BundleService;
    let redisClient: Record<string, jest.Mock>;
    let bundleRepository: Partial<Record<keyof Repository<Bundle>, jest.Mock>>;

    beforeEach(async () => {
        redisClient = {
            get: jest.fn(),
            setEx: jest.fn(),
        };

        bundleRepository = {
            createQueryBuilder: jest.fn(() => ({
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getOne: jest.fn(),
            })),
            update: jest.fn(),
            findOneBy: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BundleService,
                {
                    provide: 'REDIS_CLIENT',
                    useValue: redisClient,
                },
                {
                    provide: getRepositoryToken(Bundle),
                    useValue: bundleRepository,
                },
            ],
        }).compile();

        service = module.get<BundleService>(BundleService);
    });

    describe('createOrRenewBundle', () => {
        it('should return cached bundle if available', async () => {
            redisClient.get.mockResolvedValue(
                JSON.stringify({ id: 1, device: { code: 'DEVICE123' } })
            );

            const result = await service.createOrRenewBundle(7, { code: 'DEVICE123' } as Device);

            expect(result).toEqual(expect.objectContaining({ id: 1 }));
            expect(jest.isMockFunction(bundleRepository.createQueryBuilder)).toBe(true);
            expect(bundleRepository.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should renew existing bundle if found', async () => {
            redisClient.get.mockResolvedValue(null);

            const mockBundle = {
                id: 1,
                device: { code: 'DEVICE123', id: '1', phoneNumber: '+1234567890' },
                expiresAt: new Date(Date.now() + 7 * 86400000),
                remainingDays: 7,
                createdAt: new Date(),
            };

            (bundleRepository.createQueryBuilder as jest.Mock).mockReturnValueOnce({
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(mockBundle),
            });

            (bundleRepository.findOneBy as jest.Mock).mockResolvedValue(mockBundle);

            const result = await service.createOrRenewBundle(7, { code: 'DEVICE123' } as Device);

            expect(result).toEqual(expect.objectContaining({ id: 1 }));

            // ✅ Capture and validate the real arguments
            const setExCallArgs = redisClient.setEx.mock.calls[0];
            const [cacheKey, ttl, cacheValue] = setExCallArgs;

            expect(cacheKey).toBe('bundle:DEVICE123');
            expect(ttl).toBe(3600);

            const parsedValue = JSON.parse(cacheValue);
            expect(parsedValue).toEqual(
                expect.objectContaining({
                    id: 1,
                    remainingDays: 7,
                    device: expect.objectContaining({ code: 'DEVICE123' }),
                })
            );
        });
    });

    describe('loadActiveBundle', () => {
        it('should return cached bundle status if available', async () => {
            redisClient.get.mockResolvedValue(
                JSON.stringify({ isValid: true, remainingDays: 3, remainingHours: 5 })
            );

            const result = await service.loadActiveBundle('DEVICE123');

            expect(result).toEqual(expect.objectContaining({ isValid: true }));
            expect(jest.isMockFunction(bundleRepository.createQueryBuilder)).toBe(true);
            expect(bundleRepository.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should load and cache active bundle status', async () => {
            redisClient.get.mockResolvedValue(null);

            const mockBundle = {
                id: 1,
                device: { code: 'DEVICE123', id: '1', phoneNumber: '+1234567890' },
                expiresAt: new Date(Date.now() + 2 * 3600000),
                createdAt: new Date(),
            };

            (bundleRepository.createQueryBuilder as jest.Mock).mockReturnValueOnce({
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue(mockBundle),
            });

            const result = await service.loadActiveBundle('DEVICE123');

            expect(result).toEqual(expect.objectContaining({ isValid: true }));
            expect(bundleRepository.createQueryBuilder).toHaveBeenCalled();
            expect(redisClient.setEx).toHaveBeenCalled();
        });
    });
});
