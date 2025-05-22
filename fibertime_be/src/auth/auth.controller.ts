import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
 import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBody,
    ApiBadRequestResponse,
    ApiInternalServerErrorResponse,
    ApiUnauthorizedResponse
} from '@nestjs/swagger';
import { RequestOtpDto, VerifyOtpDto } from './dto/index';
import { OtpResponseDto } from '../util/swagger_helper/otp-response.dto';
import { LoginResponsePayload, GenericResponsePayload } from '../util/payload/index';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Authentication')
@Controller('auth')
@Public()
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('request-otp')
    @ApiOperation({ summary: 'Request OTP for phone number verification' })
    @ApiBody({ type: RequestOtpDto })
    @ApiResponse({
        status: 201,
        description: 'OTP sent successfully',
        type: OtpResponseDto
    })
    @ApiInternalServerErrorResponse({ description: 'Error: Internal Server Error' })
    @ApiBadRequestResponse({ description: 'Error: Bad Request' })
    async requestOtp(@Body() requestOtpDto: RequestOtpDto): Promise<GenericResponsePayload> {
        return this.authService.requestOtp(requestOtpDto);
    }

    @Post('login')
    @ApiOperation({ summary: 'Verify OTP and login' })
    @ApiBody({ type: VerifyOtpDto })
    @ApiResponse({
        status: 200,
        description: 'Login successful',
        type: LoginResponsePayload
    })
    @ApiUnauthorizedResponse()
    @ApiInternalServerErrorResponse({ description: 'Error: Internal Server Error' })
    @ApiBadRequestResponse({ description: 'Error: Bad Request' })
    @Post('login')
    async login(@Body() verifyOtpDto: VerifyOtpDto): Promise<LoginResponsePayload> {
        return this.authService.verifyOtp(verifyOtpDto);
    }
}