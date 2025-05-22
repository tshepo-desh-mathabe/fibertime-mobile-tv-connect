import { ApiProperty } from '@nestjs/swagger';

export class OtpResponseDto {
  @ApiProperty({
    example: 'OTP sent successfully',
    description: 'Confirmation message',
  })
  message: string;
}
