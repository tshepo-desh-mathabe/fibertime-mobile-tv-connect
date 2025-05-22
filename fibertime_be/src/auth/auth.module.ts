import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OTP } from './entities/otp.entity/otp.entity';
import { User } from '../user/entities/user.entity/user.entity';
import { GuardsModule } from '../common/guards/guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, OTP]),
    GuardsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}