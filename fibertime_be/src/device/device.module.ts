import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { Device } from './entities/device.entity/device.entity';
import { User } from '../user/entities/user.entity/user.entity';
import { GuardsModule } from '../common/guards/guards.module';
import { ConnectionModule } from '../connection/connection.module';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../common/redis/redis.module';
import { BundleModule } from '../bundle/bundle.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, User]),
    GuardsModule,
    ConnectionModule,
    ConfigModule,
    BundleModule,
    RedisModule
  ],
  controllers: [DeviceController],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule { }