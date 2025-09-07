// src/common/common.module.ts
import { Global, Module } from '@nestjs/common';
import { DateTimeService } from './services/dateTimeService';

@Global()
@Module({
  providers: [DateTimeService],
  exports: [DateTimeService],
})
export class CommonModule {}
