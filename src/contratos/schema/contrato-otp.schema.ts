import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContratoOtpDocument = ContratoOtp & Document;

/**
 * OTP de un solo uso para firmar el contrato. Se persiste en Mongo (no en
 * memoria del proceso) para que aguante reinicios de PM2. El índice TTL
 * sobre `expiraEn` borra automáticamente los OTPs caducados.
 */
@Schema({ timestamps: true, collection: 'contrato_otps' })
export class ContratoOtp {
  /** Usuario que solicitó el OTP. Único: al pedir uno nuevo se sobrescribe. */
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true, unique: true, index: true })
  usuario: Types.ObjectId;

  /** SHA-256 del código de 6 dígitos. Nunca guardamos el OTP en texto plano. */
  @Prop({ required: true })
  otpHash: string;

  /** Cuándo expira el OTP. TTL de Mongo lo borra automáticamente al pasar. */
  @Prop({ required: true, index: { expires: 0 } })
  expiraEn: Date;

  /** Intentos fallidos de verificación. Si llega a 5, se anula. */
  @Prop({ default: 0 })
  intentos: number;

  /** IP desde la que se solicitó este OTP (para auditoría de la firma). */
  @Prop({ type: String, default: null })
  ipSolicitud?: string | null;

  /** Momento en que se solicitó (redundante con createdAt, explícito). */
  @Prop({ type: Date, default: null })
  solicitadoEn?: Date | null;
}

export const ContratoOtpSchema = SchemaFactory.createForClass(ContratoOtp);
