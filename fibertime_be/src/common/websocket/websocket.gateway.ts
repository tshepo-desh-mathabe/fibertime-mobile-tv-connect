import { WebSocketGateway, SubscribeMessage, WebSocketServer, MessageBody } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { DeviceService } from 'src/device/device.service';
import { Server } from 'socket.io';
import { Public } from '../decorators/public.decorator';

@Public()
@WebSocketGateway({
  // path: '/socket.io',
  cors: {
    origin: '*'
  },
  // transports: ['websocket'JwtAuthGuard],
})
export class WebsocketService {
  private readonly logger = new Logger(WebsocketService.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly deviceService: DeviceService) {
    this.logger.log('WebsocketService constructed');
  }

  afterInit() {
    this.logger.log('WebSocket server initialized.');
  }

  handleConnection(client: any, ...args: any[]) {
    client.emit('connected', { status: 'good' });
  }

  @SubscribeMessage('message.device.code')
  async handleSubscribeDevice(@MessageBody() deviceCode: string): Promise<void> {
    this.logger.debug(`Running web socket for device-code: ${deviceCode}`);
    try {
      const connectedDevice = await this.deviceService.getConnectedDevice(deviceCode);
      this.server.emit('bundle-report', connectedDevice);
    } catch (error) {
      this.logger.error(`Subscription error for ${deviceCode}: ${error.message}`);
    }
  }
}