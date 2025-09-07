import { Global, Module } from '@nestjs/common';
import { IpDetailsService } from './ip-details.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  IpDetailsCollection,
  IpDetailsSchema,
} from './schemas/ip-detail.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IpDetailsCollection, schema: IpDetailsSchema },
    ]),
  ],
  providers: [IpDetailsService],
  exports: [IpDetailsService],
})
export class IpDetailsModule {}
