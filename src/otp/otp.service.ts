import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt'; // 📌 Importamos bcrypt para encriptar OTPs
import { randomInt } from 'crypto';
import { OtpDocument, OtpModelName } from './schema/otp.schema';
import { MailService } from 'src/mail/mail.service';
import { DateTimeService } from 'src/common/services/dateTimeService';

@Injectable()
export class OtpService {
  constructor(
    @InjectModel(OtpModelName) private otpModel: Model<OtpDocument>,
    private readonly mailService: MailService,
    private readonly dateService:DateTimeService
  ) {}

  // 📌 Generar OTP y guardarlo encriptado
  async generateOtp(rawEmail: string): Promise<void> {
    const email = (rawEmail || '').trim().toLowerCase();
    if (!email) throw new BadRequestException('Email requerido');
    const otpCode = randomInt(10000, 100000).toString(); // OTP de 5 dígitos (CSPRNG)

    const hashedCode = await bcrypt.hash(otpCode, 10); // 🔒 Encriptamos el OTP

    // 📌 Inactivar OTPs previos del usuario
    await this.otpModel.updateMany(
      { email, active: true },
      { $set: { active: false } },
    );
    // 📌 Guardar OTP en la base de datos
    const otp = new this.otpModel({ email, hashedCode,active:true });
    await otp.save();
    // 📌 AQUÍ DEBES ENVIAR EL OTP POR CORREO ELECTRÓNICO ANTES DE GUARDARLO 🔥
    // Ejemplo: this.mailService.sendOtp(email, otpCode);
    const fecha = this.dateService.formatEC();
    const html = this.mailService.getTemplate('otp.html', { codigo: otpCode ,fecha});
    await this.mailService.enviar(email, 'OTP  de verificación', html);

    // El código solo viaja por correo: nunca se devuelve ni se registra en logs.
  }

// 📌 Verificar OTP (solo contra el OTP activo más reciente)
async verifyOtp(rawEmail: string, code: string): Promise<boolean> {
  const email = (rawEmail || '').trim().toLowerCase();
  if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
    throw new BadRequestException('Código OTP incorrecto');
  }
  // 1) Buscar el OTP ACTIVO más reciente para el email
  const otp = await this.otpModel
    .findOne({ email, active: true })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  if (!otp) {
    throw new NotFoundException('Código OTP incorrecto o no encontrado');
  }

  // 2) Validar expiración
  if (otp.expiresAt && otp.expiresAt < new Date()) {
    // Opcional: inactivar si está vencido
    await this.otpModel.updateOne({ _id: otp._id }, { $set: { active: false } });
    throw new BadRequestException('El OTP ha expirado');
  }

  // 3) Validar que no haya sido usado
  if (otp.used) {
    throw new BadRequestException('El OTP ya ha sido utilizado');
  }

  // 4) Comparar código en texto plano vs hash almacenado
  const isMatch = await bcrypt.compare(code, otp.hashedCode);
  if (!isMatch) {
    // Máximo 5 intentos por código: después hay que pedir uno nuevo.
    const intentos = (otp.intentos ?? 0) + 1;
    await this.otpModel.updateOne(
      { _id: otp._id },
      { $inc: { intentos: 1 }, ...(intentos >= 5 ? { $set: { active: false } } : {}) },
    );
    throw new BadRequestException(
      intentos >= 5 ? 'Demasiados intentos. Solicita un código nuevo.' : 'Código OTP incorrecto',
    );
  }

  // 5) Marcar como usado e inactivar
  const marcado = await this.otpModel.updateOne(
    // Atómico: si otra verificación concurrente ya lo usó, no se rearma el permiso.
    { _id: otp._id, used: false, active: true },
    {
      $set: {
        used: true,
        active: false,
        usedAt: new Date(),
        // Habilita UN cambio de clave para este email durante 15 minutos.
        resetGrantUntil: new Date(Date.now() + 15 * 60 * 1000),
        resetGrantUsed: false,
        // El TTL borra el documento al vencer: lo alineamos con la ventana.
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    }
  );
  if (marcado.modifiedCount !== 1) {
    throw new BadRequestException('El OTP ya ha sido utilizado');
  }

  // 6) (Defensa en profundidad) Inactivar cualquier otro OTP activo que haya quedado para el mismo email
  await this.otpModel.updateMany(
    { email, active: true, _id: { $ne: otp._id } },
    { $set: { active: false } }
  );

  return true;
}

}
