import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IpDetailDocument = HydratedDocument<IpDetail>;

@Schema()
export class IpDetail {
  @Prop()
  ip: string;

  @Prop({ required: true, type: Object })
  data: any;

  @Prop({ required: true, default: Date.now, expires: 60 * 60 * 3 })
  createdAt?: Date;
}

export const IpDetailsSchema = SchemaFactory.createForClass(IpDetail);
export const IpDetailsCollection = 'ips';
