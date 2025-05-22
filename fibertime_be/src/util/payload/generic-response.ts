import { ApiProperty } from "@nestjs/swagger";

export class GenericResponsePayload {
    @ApiProperty()
    message: string;
}