import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'configuraciones' })
export class Configuracion extends Document {
  @Prop({ required: true, unique: true, trim: true, index: true })
  clave: string;

  @Prop({ required: true, trim: true })
  valor: string;

  @Prop({ trim: true })
  descripcion: string;
}

export const ConfiguracionSchema = SchemaFactory.createForClass(Configuracion);
