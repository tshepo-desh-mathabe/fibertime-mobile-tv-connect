import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity/user.entity';

export class DeviceResponseDto {
    @ApiProperty()
    id: string;
    
    @ApiProperty()
    deviceCode: string;

    @ApiProperty()
    expiresAt: Date;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    phoneNumber: string;
}