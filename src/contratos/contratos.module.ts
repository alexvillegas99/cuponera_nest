import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Usuario, UsuarioSchema } from 'src/usuarios/schema/usuario.schema';
import { S3Module } from 'src/amazon-s3/amazon-s3.module';
import { MailModule } from 'src/mail/mail.module';
import { ConfiguracionModule } from 'src/configuracion/configuracion.module';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import {
  ContratoOtp,
  ContratoOtpSchema,
} from './schema/contrato-otp.schema';

@Module({
  imports: [
    S3Module,
    MailModule,
    ConfiguracionModule,
    MongooseModule.forFeature([
      { name: Usuario.name, schema: UsuarioSchema },
      { name: ContratoOtp.name, schema: ContratoOtpSchema },
    ]),
  ],
  controllers: [ContratosController],
  providers: [ContratosService],
  exports: [ContratosService],
})
export class ContratosModule implements OnModuleInit {
  constructor(private readonly service: ContratosService) {}

  /**
   * Al boot, marca como contratoAceptado=true a TODOS los admin-local
   * existentes antes de este deploy: el contrato solo aplica a NUEVOS.
   * Idempotente — corre cada boot pero solo afecta a los no marcados.
   */
  async onModuleInit() {
    // Fecha de corte = ahora. Los admin-local creados de aquí en adelante
    // sí tienen que firmar; los de antes no.
    await this.service.bootstrapMarcarExistentes(new Date());
  }
}
