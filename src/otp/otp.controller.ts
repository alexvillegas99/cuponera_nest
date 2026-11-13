import { RateLimit } from 'src/common/security/rate-limit.guard';
import { Controller, Post, Body } from '@nestjs/common';

import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { GetUser } from 'src/auth/decorators';

@ApiTags('otps') // 📌 Categoría en Swagger
@Controller('otps')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('generate')
  @RateLimit(5, 15 * 60_000)
  @ApiBody({
    schema: {
      example: { email: 'user@example.com' },
    },
  })
  @ApiResponse({ status: 201, description: 'OTP generado exitosamente' })
  async generate(@Body('email') email: string) {
    await this.otpService.generateOtp(email);
    return { message: 'OTP generado exitosamente' };
  }

  @Post('verify')
  @RateLimit(10, 15 * 60_000)
  @ApiBody({
    schema: {
      example: { email: 'user@example.com', code: '123456' },
    },
  })

  @ApiResponse({ status: 200, description: 'OTP validado correctamente' })
  async verify(@Body('email') email: string, @Body('code') code: string) {
    await this.otpService.verifyOtp(email, code);
    return { message: 'OTP validado correctamente' };
  }
}
