import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OTP } from './entities/otp.entity/otp.entity';
import { User } from '../user/entities/user.entity/user.entity';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { calculateExpiryTime } from '../util/calculate.helper';
import { UpdateResult } from 'typeorm';

jest.mock('crypto');
jest.mock('../util/calculate.helper');

const mockRepository = () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    increment: jest.fn(),
});

describe('AuthService', () => {
    let authService: AuthService;
    let otpRepository: ReturnType<typeof mockRepository>;
    let userRepository: ReturnType<typeof mockRepository>;
    let jwtService: JwtService;
    let redisClient: any;

    const mockRedisClient = {
        get: jest.fn(),
        setEx: jest.fn(),
    };

    const mockJwtService = {
        sign: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn().mockReturnValue(20),
    };

    const mockUser = {
        id: '1',
        phoneNumber: '+1234567890',
    };

    const mockOtp = {
        id: '1',
        code: '123456',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 0,
        user: mockUser,
        createdAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: getRepositoryToken(OTP),
                    useValue: mockRepository(),
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: mockRepository(),
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: 'REDIS_CLIENT',
                    useValue: mockRedisClient,
                },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        otpRepository = module.get(getRepositoryToken(OTP));
        userRepository = module.get(getRepositoryToken(User));
        jwtService = module.get(JwtService);
        redisClient = module.get('REDIS_CLIENT');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('requestOtp', () => {
        it('should throw UnauthorizedException if rate limit is exceeded', async () => {
            redisClient.get.mockResolvedValue('3');

            await expect(authService.requestOtp({ phoneNumber: '+1234567890' }))
                .rejects
                .toThrow(UnauthorizedException);
        });

        it('should create new user if none exists', async () => {
            redisClient.get.mockResolvedValue(null);
            userRepository.findOne.mockResolvedValue(null);
            userRepository.create.mockReturnValue(mockUser);
            userRepository.save.mockResolvedValue(mockUser);
            (crypto.randomInt as jest.Mock).mockReturnValue(123456);
            otpRepository.save.mockResolvedValue(mockOtp);
            (calculateExpiryTime as jest.Mock).mockReturnValue(mockOtp.expiresAt);

            const result = await authService.requestOtp({ phoneNumber: '+1234567890' });

            expect(userRepository.create).toHaveBeenCalled();
            expect(userRepository.save).toHaveBeenCalledWith(mockUser);
            expect(otpRepository.save).toHaveBeenCalledWith({
                code: '123456',
                expiresAt: mockOtp.expiresAt,
                user: mockUser,
            });
            expect(result).toEqual({ message: '123456' });
        });

        it('should use existing user if found', async () => {
            redisClient.get.mockResolvedValue(null);
            userRepository.findOne.mockResolvedValue(mockUser);
            (crypto.randomInt as jest.Mock).mockReturnValue(123456);
            otpRepository.save.mockResolvedValue(mockOtp);
            (calculateExpiryTime as jest.Mock).mockReturnValue(mockOtp.expiresAt);

            const result = await authService.requestOtp({ phoneNumber: '+1234567890' });

            expect(userRepository.findOne).toHaveBeenCalledWith({ where: { phoneNumber: '+1234567890' } });
            expect(otpRepository.save).toHaveBeenCalled();
            expect(result).toEqual({ message: '123456' });
        });

        it('should set rate limit in redis', async () => {
            redisClient.get.mockResolvedValue(null);
            userRepository.findOne.mockResolvedValue(mockUser);
            (crypto.randomInt as jest.Mock).mockReturnValue(123456);
            otpRepository.save.mockResolvedValue(mockOtp);
            (calculateExpiryTime as jest.Mock).mockReturnValue(mockOtp.expiresAt);

            await authService.requestOtp({ phoneNumber: '+1234567890' });

            expect(redisClient.setEx).toHaveBeenCalledWith(
                'otp:rate-limit:+1234567890',
                3600,
                '1'
            );
        });
    });

    describe('verifyOtp', () => {
        it('should throw UnauthorizedException if no OTP record found', async () => {
            otpRepository.findOne.mockResolvedValue(null);

            await expect(authService.verifyOtp({ phoneNumber: '+1234567890', otp: '123456' }))
                .rejects
                .toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if OTP is invalid', async () => {
            otpRepository.findOne.mockResolvedValue(mockOtp);

            await expect(authService.verifyOtp({ phoneNumber: '+1234567890', otp: '654321' }))
                .rejects
                .toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if OTP is expired', async () => {
            const expiredOtp = { ...mockOtp, expiresAt: new Date(Date.now() - 1000) };
            otpRepository.findOne.mockResolvedValue(expiredOtp);

            await expect(authService.verifyOtp({ phoneNumber: '+1234567890', otp: '123456' }))
                .rejects
                .toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException if max attempts reached', async () => {
            const maxAttemptsOtp = { ...mockOtp, attempts: 3 };
            otpRepository.findOne.mockResolvedValue(maxAttemptsOtp);

            await expect(authService.verifyOtp({ phoneNumber: '+1234567890', otp: '123456' }))
                .rejects
                .toThrow(UnauthorizedException);
        });

        it('should throw NotFoundException if user not found', async () => {
            otpRepository.findOne.mockResolvedValue(mockOtp);
            userRepository.findOne.mockResolvedValue(null);

            await expect(authService.verifyOtp({ phoneNumber: '+1234567890', otp: '123456' }))
                .rejects
                .toThrow(NotFoundException);
        });

        it('should return JWT token and user info on successful verification', async () => {
            otpRepository.findOne.mockResolvedValue(mockOtp);
            userRepository.findOne.mockResolvedValue(mockUser);
            otpRepository.increment.mockResolvedValue({ affected: 1 } as UpdateResult);
            mockJwtService.sign.mockReturnValue('jwt-token');

            const result = await authService.verifyOtp({ phoneNumber: '+1234567890', otp: '123456' });

            expect(otpRepository.increment).toHaveBeenCalledWith({ id: '1' }, 'attempts', 1);
            expect(jwtService.sign).toHaveBeenCalledWith({
                sub: '1',
                phoneNumber: '+1234567890',
            });
            expect(result).toEqual({
                token: 'Bearer jwt-token',
                user: {
                    phoneNumber: '+1234567890',
                },
            });
        });
    });
});
