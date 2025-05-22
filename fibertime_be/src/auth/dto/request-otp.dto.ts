import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsNotEmpty } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({required: true})
  @IsPhoneNumber()
  @IsNotEmpty()
  phoneNumber: string;
}