import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RolDocument = Rol & Document;

@Schema({ timestamps: true })
export class Rol {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ trim: true, default: '' })
  descripcion: string;

  @Prop({ type: [String], default: [] })
  permisos: string[];

  @Prop({ default: false })
  esSistema: boolean;

  @Prop({ default: true })
  estado: boolean;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;
}

export const RolSchema = SchemaFactory.createForClass(Rol);
