import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MailService } from './mail.service';
import { CreateMailDto } from './dto/create-mail.dto';
import { UpdateMailDto } from './dto/update-mail.dto';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}



  @Get()
  async findAll() {
    const html = this.mailService.getTemplate('otp.html', {
      nombre: 'Carlos',
      codigo: '473812'
    });
    await this.mailService.enviar('av058554@gmail.com', 'Tu código de verificación', html);

    const html2 = this.mailService.getTemplate('bienvenida.html', {
      nombre: 'Carlos',
    });
    await this.mailService.enviar('av058554@gmail.com', 'Bienvenida', html2);

    const html3 = this.mailService.getTemplate('credenciales.html', {
      nombre: 'Carlos',
    });
    await this.mailService.enviar('av058554@gmail.com', 'Credenciales', html2);


    


  }

}
