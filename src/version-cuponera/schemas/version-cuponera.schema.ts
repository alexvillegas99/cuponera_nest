import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VersionCuponeraDocument = VersionCuponera & Document;

@Schema({ timestamps: true })
export class VersionCuponera {
  @Prop({ required: true })
  nombre: string;

  @Prop({ default: true })
  estado: boolean;

  @Prop({ required: true })
  numeroDeLocales: number; // límite de usos por cupón
}

export const VersionCuponeraSchema = SchemaFactory.createForClass(VersionCuponera);
