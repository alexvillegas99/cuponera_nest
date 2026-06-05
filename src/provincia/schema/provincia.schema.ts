import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProvinciaDocument = Provincia & Document;

@Schema({ timestamps: true, collection: 'provincias' })
export class Provincia {
  /** Nombre de la provincia (ej: Tungurahua) */
  @Prop({ required: true, trim: true })
  nombre: string;

  /** Código DPA de 2 dígitos (ej: '18' Tungurahua) */
  @Prop({ trim: true })
  codigo?: string;

  @Prop({ default: true })
  estado: boolean;
}

export const ProvinciaSchema = SchemaFactory.createForClass(Provincia);

ProvinciaSchema.index({ nombre: 1 }, { unique: true });
ProvinciaSchema.index({ codigo: 1 });
