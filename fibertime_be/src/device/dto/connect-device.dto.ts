import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Length } from 'class-validator';

export class ConnectDeviceDto {
    @ApiProperty({required: true})
    @IsNotEmpty()
    phoneNumber: string;

    @ApiProperty({required: true})
    @Length(4, 4)
    @IsNotEmpty()
    deviceCode: string;
}