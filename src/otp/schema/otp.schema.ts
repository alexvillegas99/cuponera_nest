import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type OtpDocument = HydratedDocument<Otp>;

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true })
  email: string; // 📌 Asociamos el OTP con un email

  @Prop({ required: true })
  hashedCode: string; // 📌 Guardamos el OTP encriptado

  @Prop({ required: true, default: () => new Date(Date.now() + 5 * 60 * 1000) })
  expiresAt: Date; // 📌 Expira en 5 minutos

  @Prop({ default: false })
  used: boolean; // 📌 Indica si el OTP fue utilizado

    @Prop({ default: true }) // 👉 Nuevo campo para controlar si está activo
  active: boolean;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
export const OtpModelName = 'otps';

// 📌 Índice para que los OTPs expiren automáticamente en MongoDB
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
