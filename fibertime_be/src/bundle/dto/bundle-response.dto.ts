import { ApiProperty } from '@nestjs/swagger';

export class BundleResponseDto {
    @ApiProperty()
    expiresAt: Date;

    @ApiProperty()
    remainingDays: number;

    @ApiProperty()
    remainingHours: number;

    @ApiProperty()
    remainingMinutes: number;
}