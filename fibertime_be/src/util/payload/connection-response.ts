import { ApiProperty } from '@nestjs/swagger';
import { UserBundleDto } from 'src/bundle/dto/user-bundle.dto/user-bundle.dto';

export class ConnectionResponsePayload {
    @ApiProperty()
    connectedUserPhoneNumber: string;
    @ApiProperty()
    connectionStatus: string | undefined;
    @ApiProperty()
    connectionCreatedAt: Date | undefined;
    @ApiProperty()
    deviceCode: string;
    @ApiProperty()
    deviceExpiresAt: Date;
    @ApiProperty()
    deviceCreatedAt: Date;
    @ApiProperty()
    bundle: UserBundleDto | null;
}
