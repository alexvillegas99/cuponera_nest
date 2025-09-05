import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CiudadDocument = Ciudad & Document;

@Schema({ timestamps: true, collection: 'ciudades' })
export class Ciudad {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ default: true })
  estado: boolean;

  @Prop({ type: { lat: Number, lng: Number }, _id: false })
  geo?: { lat: number; lng: number };

    @Prop({ default: true })
  visibleParaRegistro: boolean;
}

export const CiudadSchema = SchemaFactory.createForClass(Ciudad);

// índices útiles
CiudadSchema.index({ nombre: 1 }, { unique: true });
CiudadSchema.index({ visibleParaRegistro: 1 });
