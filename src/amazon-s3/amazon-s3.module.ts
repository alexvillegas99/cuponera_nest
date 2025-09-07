// s3.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AmazonS3Service } from './amazon-s3.service';
import { S3_CLIENT, s3ClientProvider } from './providers/s3.provider';

@Module({
  imports: [ConfigModule],
  providers: [s3ClientProvider, AmazonS3Service],
  exports: [AmazonS3Service, { provide: S3_CLIENT, useExisting: S3_CLIENT }],
})
export class S3Module {}
