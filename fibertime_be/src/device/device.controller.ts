import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { DeviceService } from './device.service';
import { ConnectDeviceDto } from './dto/connect-device.dto';
import { DeviceResponseDto } from './dto/device-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth/jwt-auth.guard';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenericResponsePayload } from '../util/payload';
import { ConnectionResponsePayload } from 'src/util/payload/connection-response';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Device')
@Controller('device')
export class DeviceController {
    constructor(private readonly deviceService: DeviceService) { }

    @Post('create-device-code')
    @Public()
    @ApiOperation({ summary: 'Generate a device pairing code' })
    @ApiResponse({ status: 201, type: GenericResponsePayload })
    async createDeviceCode(): Promise<GenericResponsePayload> {
        return this.deviceService.generatePairingCode();
    }

    @Get(':code')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get device by pairing code' })
    @ApiResponse({ status: 200, description: 'Device found', type: DeviceResponseDto })
    @ApiResponse({ status: 403, description: 'Error: Forbidden' })
    @ApiResponse({ status: 404 })
    async getDevice(@Param('code') code: string): Promise<DeviceResponseDto> {
        return this.deviceService.getDeviceByCode(code);
    }

    @Post('connect-device')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiBody({ type: ConnectDeviceDto })
    @ApiOperation({ summary: 'Connect a device to a user' })
    @ApiResponse({ status: 201, description: 'Device connected successfully', type: DeviceResponseDto })
    @ApiResponse({ status: 403, description: 'Error: Forbidden' })
    @ApiResponse({ status: 400, description: 'Error: Bad Request' })
    @ApiResponse({ status: 404, description: 'Error: Not Found' })
    @ApiResponse({ status: 409, description: 'Error: Conflict' })
    async connectDevice(@Body() connectDeviceDto: ConnectDeviceDto): Promise<DeviceResponseDto> {
        return this.deviceService.connectDevice(
            connectDeviceDto.phoneNumber,
            connectDeviceDto.deviceCode,
        );
    }

    @Get('connection-status/:code')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get connection status of a device' })
    @ApiResponse({ status: 200, description: 'Connection status retrieved', type: ConnectionResponsePayload })
    @ApiResponse({ status: 404, description: 'Error: Not Found' })
    async getConnectionStatus(@Param('code') code: string): Promise<ConnectionResponsePayload> {
        return await this.deviceService.getConnectedDevice(code);
    }
}