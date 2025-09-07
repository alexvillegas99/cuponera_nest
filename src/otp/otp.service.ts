import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt'; // 📌 Importamos bcrypt para encriptar OTPs
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
  async generateOtp(email: string): Promise<string> {
    const otpCode = Math.floor(10000 + Math.random() * 90000).toString(); // 🔥 Genera OTP de 5 dígitos

    const hashedCode = await bcrypt.hash(otpCode, 10); // 🔒 Encriptamos el OTP

    // 📌 Inactivar OTPs previos del usuario
    await this.otpModel.updateMany(
      { email, active: true },
      { $set: { active: false } },
    );
    // 📌 Guardar OTP en la base de datos
    const otp = new this.otpModel({ email, hashedCode,active:true });
    await otp.save();
    console.log('OTP:', otpCode); // 🔥 Mostrar OTP en consola (solo para pruebas)
    // 📌 AQUÍ DEBES ENVIAR EL OTP POR CORREO ELECTRÓNICO ANTES DE GUARDARLO 🔥
    // Ejemplo: this.mailService.sendOtp(email, otpCode);
    console.log('📧 Enviando OTP por correo...'); // 🔥 Mostrar mensaje en consola (solo para pruebas)
    console.log('📧 Email:', email); // 🔥 Mostrar OTP en consola (solo para pruebas)
    const fecha = this.dateService.formatEC();
    const html = this.mailService.getTemplate('otp.html', { codigo: otpCode ,fecha});
    await this.mailService.enviar(email, 'OTP  de verificación', html);

    return otpCode; // 📌 Retornamos el OTP (solo para pruebas, en producción NO SE RETORNA)
  }

// 📌 Verificar OTP (solo contra el OTP activo más reciente)
async verifyOtp(email: string, code: string): Promise<boolean> {
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
    throw new BadRequestException('Código OTP incorrecto');
  }

  // 5) Marcar como usado e inactivar
  await this.otpModel.updateOne(
    { _id: otp._id },
    { $set: { used: true, active: false, usedAt: new Date() } }
  );

  // 6) (Defensa en profundidad) Inactivar cualquier otro OTP activo que haya quedado para el mismo email
  await this.otpModel.updateMany(
    { email, active: true, _id: { $ne: otp._id } },
    { $set: { active: false } }
  );

  return true;
}

}
