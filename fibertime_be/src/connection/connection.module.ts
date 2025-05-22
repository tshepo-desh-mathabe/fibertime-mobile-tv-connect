import { forwardRef, Module } from '@nestjs/common';
import { WebsocketService } from '../common/websocket/websocket.gateway';
import { ConnectionService } from './connection.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../device/entities/device.entity/device.entity';
import { RedisModule } from '../common/redis/redis.module';
import { GuardsModule } from '../common/guards/guards.module';
import { Connection } from './entities/connection.entity/connection.entity';
import { DeviceModule } from 'src/device/device.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, Connection]),
    GuardsModule,
    RedisModule,
    forwardRef(() => DeviceModule)
  ],
  providers: [ConnectionService, WebsocketService],
  exports: [ConnectionService]
})
export class ConnectionModule { }