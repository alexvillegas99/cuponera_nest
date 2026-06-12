import { Injectable } from '@nestjs/common';
import { CreateMailDto } from './dto/create-mail.dto';
import { UpdateMailDto } from './dto/update-mail.dto';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { MailerService } from '@nestjs-modules/mailer';
@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async enviar(to: string, subject: string, html: string) {
    const mailOptions = {
      to,
      subject,
      html: html,
    };

    try {
      console.log('📧 Enviando correo...');
   //   console.log(mailOptions);
      const result = await this.mailerService.sendMail(mailOptions);
      console.log('✉️ Correo enviado:', result.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error al enviar el correo:', error);
      return false;
    }
  }

  getTemplate(fileName: string, variables: Record<string, string>): string {
    const filePath = this.getTemplatePath(fileName);
    let template = fs.readFileSync(filePath, 'utf8');

    // Variables de marca comunes a TODOS los correos. El caller puede
    // sobreescribirlas. Evita que plantillas con {{enlace_soporte}}, {{anio}},
    // etc. queden con placeholders crudos si el servicio no las pasa.
    const data: Record<string, string> = {
      anio: String(new Date().getFullYear()),
      correo_soporte: 'info@ecuenjoy.com',
      enlace_soporte: 'https://portal.ecuenjoy.com/soporte',
      enlace_portal: 'https://portal.ecuenjoy.com/',
      ...variables,
    };

    for (const [key, value] of Object.entries(data)) {
      // Reemplazo seguro: función como replacement para no interpretar
      // secuencias como $&, $1 dentro de los valores (p. ej. "$10.00").
      template = template.replace(
        new RegExp(`{{\\s*${key}\\s*}}`, 'g'),
        () => value ?? '',
      );
    }

    // Limpiar cualquier placeholder no resuelto para que no aparezca crudo.
    template = template.replace(/{{\s*[\w.]+\s*}}/g, '');

    return template;
  }

  getTemplatePath(fileName: string) {
    // Buscar la plantilla en varias ubicaciones por robustez entre dev y prod:
    //  1) junto al código compilado (dist/mail/templates) — se copia vía
    //     nest-cli assets y viaja con el deploy.
    //  2) src/mail/templates relativo al cwd (modo dev / instalación antigua).
    const candidatos = [
      path.join(__dirname, 'templates', fileName),
      path.join(process.cwd(), 'src', 'mail', 'templates', fileName),
      path.join(process.cwd(), 'dist', 'mail', 'templates', fileName),
    ];
    for (const p of candidatos) {
      try {
        if (fs.existsSync(p)) return p;
      } catch (_) {
        // siguiente candidato
      }
    }
    // Por defecto, mantener el comportamiento histórico (src).
    return path.join(process.cwd(), 'src', 'mail', 'templates', fileName);
  }
}
