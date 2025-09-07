import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import {
  MAIL_HOST,
  MAIL_PASS,
  MAIL_PORT,
  MAIL_SECURE,
  MAIL_USER,
} from 'src/config/config.env';

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get(MAIL_HOST),
          port: configService.get(MAIL_PORT),
          secure: configService.get(MAIL_SECURE),
          auth: {
            user: configService.get(MAIL_USER),
            pass: configService.get(MAIL_PASS),
          },
        },
        defaults: {
          from: `"Autonic" <${configService.get(MAIL_USER)}>`,
        },
      }),
    }),
  ], 
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
