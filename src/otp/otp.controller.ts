import { Controller, Post, Body } from '@nestjs/common';

import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { GetUser } from 'src/auth/decorators';

@ApiTags('otps') // 📌 Categoría en Swagger
@Controller('otps')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('generate')
  @ApiBody({
    schema: {
      example: { email: 'user@example.com' },
    },
  })
  @ApiResponse({ status: 201, description: 'OTP generado exitosamente' })
  async generate(@Body('email') email: string) {
    const otpCode = await this.otpService.generateOtp(email);
    return { message: 'OTP generado exitosamente', otp: otpCode };
  }

  @Post('verify')
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
