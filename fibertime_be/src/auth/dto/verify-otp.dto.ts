import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsNotEmpty, Length } from 'class-validator';

export class VerifyOtpDto {
    @ApiProperty({required: true})
    @IsPhoneNumber()
    @IsNotEmpty()
    phoneNumber: string;

    @ApiProperty({required: true})
    @Length(5, 6)
    @IsNotEmpty()
    otp: string;
}