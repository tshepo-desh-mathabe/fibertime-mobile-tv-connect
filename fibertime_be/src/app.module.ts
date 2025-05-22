import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DeviceModule } from './device/device.module';
import { ConnectionModule } from './connection/connection.module';
import { BundleModule } from './bundle/bundle.module';
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { JwtAuthGuard } from './common/guards/jwt-auth/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { GuardsModule } from './common/guards/guards.module';
import { WebSocketModule } from './common/websocket/websocket.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    DatabaseModule,
    RedisModule,
    GuardsModule,
    AuthModule,
    DeviceModule,
    ConnectionModule,
    BundleModule,
    WebSocketModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})

export class AppModule { }