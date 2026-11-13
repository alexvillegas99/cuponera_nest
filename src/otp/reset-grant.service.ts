import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OtpDocument, OtpModelName } from './schema/otp.schema';

/**
 * Autoriza un cambio de contraseña solo si el mismo email verificó un OTP
 * (POST /otps/verify) en los últimos 15 minutos. Cada verificación habilita
 * un único cambio. Compatible con la app y la web actuales, que ya verifican
 * el código antes de llamar al reset.
 */
@Injectable()
export class ResetGrantService {
  constructor(@InjectModel(OtpModelName) private readonly otpModel: Model<OtpDocument>) {}

  async consume(rawEmail: string): Promise<void> {
    const email = (rawEmail || '').trim().toLowerCase();
    const grant = await this.otpModel.findOneAndUpdate(
      {
        email,
        used: true,
        resetGrantUsed: false,
        resetGrantUntil: { $gt: new Date() },
      },
      { $set: { resetGrantUsed: true } },
      { sort: { createdAt: -1 } },
    );
    if (!grant) {
      throw new ForbiddenException(
        'Verifica el código enviado a tu correo antes de cambiar la contraseña.',
      );
    }
  }
}
