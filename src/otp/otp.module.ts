import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { OtpModelName, OtpSchema } from './schema/otp.schema';
import { UsuariosModule } from 'src/usuarios/usuarios.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: OtpModelName, schema: OtpSchema }]),
    UsuariosModule
  ],
  controllers: [OtpController],
  providers: [OtpService],
})
export class OtpModule {}
