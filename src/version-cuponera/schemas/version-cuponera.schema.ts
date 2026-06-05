import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VersionCuponeraDocument = VersionCuponera & Document;

@Schema({ timestamps: true, collection: 'versioncuponeras' })
export class VersionCuponera {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ default: true })
  estado: boolean;

  @Prop({ required: false })
  descripcion?: string;

  @Prop({ default: '0.00', trim: true })
  precio: string;

  // Disponible en estas ciudades (refs a Ciudad)
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Ciudad' }], default: [] })
  ciudadesDisponibles: Types.ObjectId[];

  // Disponible en estas provincias completas (refs a Provincia).
  // Se expanden a sus ciudades al filtrar locales.
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Provincia' }], default: [] })
  provinciasDisponibles: Types.ObjectId[];
}

export const VersionCuponeraSchema = SchemaFactory.createForClass(VersionCuponera);

// Índices útiles (opcionales)
VersionCuponeraSchema.index({ nombre: 1 }, { unique: true });
VersionCuponeraSchema.index({ estado: 1 });
