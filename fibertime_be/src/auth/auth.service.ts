import { Injectable, UnauthorizedException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { OTP } from './entities/otp.entity/otp.entity';
import { User } from '../user/entities/user.entity/user.entity';
import { RequestOtpDto, VerifyOtpDto } from './dto/index';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common/decorators';
import { LoginResponsePayload, GenericResponsePayload } from '../util/payload/index';
import { calculateExpiryTime } from 'src/util/calculate.helper';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpExpiryMinutes: number;

  constructor(
    @InjectRepository(OTP)
    private readonly otpRepository: Repository<OTP>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redisClient: any,
  ) {
    this.otpExpiryMinutes = this.configService.get<number>('BUNDLE_EXPIRY_DAYS', 20);
  }

  /**
   * Handles OTP request for a given phone number.
   * - Limits OTP requests using Redis rate-limiting.
   * - Generates a 6-digit OTP and stores it in the database with a 5-minute expiry.
   * - Logs the OTP to the console (in production, this should be sent via SMS).
   * 
   * @param requestOtpDto Object containing the phone number.
   * @throws UnauthorizedException if rate limit is exceeded.
   */
  async requestOtp(requestOtpDto: RequestOtpDto): Promise<GenericResponsePayload> {
    const { phoneNumber } = requestOtpDto;
    this.logger.log(`OTP requested for phone: ${phoneNumber}`);

    // Rate limiting check
    const rateLimitKey = `otp:rate-limit:${phoneNumber}`;
    const attempts = await this.redisClient.get(rateLimitKey);

    if (attempts && parseInt(attempts) >= 3) {
      this.logger.warn(`Rate limit exceeded for phone: ${phoneNumber}`);
      throw new UnauthorizedException('Too many OTP requests. Please try again later.');
    }

    // Find or create user without maintaining OTP relation
    let user = await this.userRepository.findOne({ where: { phoneNumber } });
    if (!user) {
      user = this.userRepository.create({ phoneNumber });
      await this.userRepository.save(user);
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = calculateExpiryTime(this.otpExpiryMinutes);

    // Save OTP
    await this.otpRepository.save({
      code: otp,
      expiresAt,
      user
    });

    // Set rate limit
    await this.redisClient.setEx(rateLimitKey, 3600, '1');
    this.logger.debug(`Rate limit set for phone: ${phoneNumber}`);

    this.logger.log(`OTP for ${phoneNumber}: ${otp}`);
    return { message: otp };
  }

  /**
   * Verifies a submitted OTP against the most recent OTP stored in the database.
   * - Checks for validity, expiry, and max attempts.
   * - Increments attempt count for each verification attempt.
   * - If verification is successful, it finds or creates a user and generates a JWT token.
   * 
   * @param verifyOtpDto Object containing phone number and OTP code.
   * @returns JWT token and basic user information on successful verification.
   * @throws UnauthorizedException for invalid, expired, or max-attempted OTPs.
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<LoginResponsePayload> {
    const { phoneNumber, otp } = verifyOtpDto;
    this.logger.log(`OTP verification attempt for phone: ${phoneNumber}`);

    // Find the most recent OTP
    const otpRecord = await this.otpRepository.findOne({
      where: {
        user: { phoneNumber },
      },
      order: { createdAt: 'DESC' },
      relations: ['user']
    });

    if (!otpRecord) {
      this.logger.warn(`No OTP record found for phone: ${phoneNumber}`);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (otpRecord.code !== otp) {
      this.logger.warn(`Invalid OTP provided for phone: ${phoneNumber}`);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (otpRecord.expiresAt < new Date()) {
      this.logger.warn(`Expired OTP used for phone: ${phoneNumber}`);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      this.logger.warn(`Max OTP attempts reached for phone: ${phoneNumber}`);
      throw new UnauthorizedException('Too many attempts. Please request a new OTP.');
    }

    // Increment attempts
    await this.otpRepository.increment({ id: otpRecord.id }, 'attempts', 1);
    this.logger.debug(`OTP attempt incremented for phone: ${phoneNumber}`);

    // Find or create user
    const user = await this.userRepository.findOne({ where: { phoneNumber } });
    if (!user) throw new NotFoundException('User not found');

    // Generate JWT token
    const token = 'Bearer ' + this.jwtService.sign({
      sub: user?.id,
      phoneNumber: user?.phoneNumber,
    });

    this.logger.log(`Successful login for user: ${user?.id}`);

    return {
      token,
      user: {
        phoneNumber: user.phoneNumber,
      },
    };
  }
}