import { Module } from '@nestjs/common';
import { WebsocketService } from './websocket.gateway';
import { DeviceModule } from '../../device/device.module';

@Module({
  imports: [DeviceModule],
  providers: [WebsocketService]
})
export class WebSocketModule {}