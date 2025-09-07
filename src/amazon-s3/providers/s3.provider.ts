// s3.provider.ts
import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = Symbol('S3_CLIENT');

export const s3ClientProvider: FactoryProvider = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const region = config.get<string>('AWS_S3_BUCKET_REGION');
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error('Faltan variables AWS_* (region, accessKeyId, secretAccessKey)');
    }
    return new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  },
};
