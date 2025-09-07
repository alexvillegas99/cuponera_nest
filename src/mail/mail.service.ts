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
      console.log(mailOptions)
      const result = await this.mailerService.sendMail(mailOptions);
      console.log('✉️ Correo enviado:', result);
      return true;
    } catch (error) {
      console.error('❌ Error al enviar el correo:', error);
      return false;
    }
  }

  getTemplate(fileName: string, variables: Record<string, string>): string {
    const filePath = this.getTemplatePath(fileName);
    let template = fs.readFileSync(filePath, 'utf8');

    for (const [key, value] of Object.entries(variables)) {
      template = template.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return template;
  }

  getTemplatePath(fileName: string) {
    const basePath = path.join(process.cwd(), 'src', 'mail', 'templates');

    return path.join(basePath, fileName);
  }
}
