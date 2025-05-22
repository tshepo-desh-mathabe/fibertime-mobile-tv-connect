import { ApiProperty } from '@nestjs/swagger';

export class UserBundleDto {
    @ApiProperty()
    expiresAt: Date;

    @ApiProperty()
    remainingDays: number;

    @ApiProperty()
    remainingHours: number;

    @ApiProperty()
    isValid: boolean;
}
