import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoriaDocument = Categoria & Document;

@Schema({ timestamps: true, collection: 'categorias' })
export class Categoria {
  @Prop({ required: true, trim: true })
  nombre: string; // Ejemplo: Restaurante, Bar, Cafetería

  @Prop({ trim: true })
  descripcion?: string; // Descripción opcional

  @Prop({ trim: true })
  icono?: string; // Nombre de ícono (ej. "utensils", "coffee")

  @Prop({ default: true })
  estado: boolean; // Activa o no
}

export const CategoriaSchema = SchemaFactory.createForClass(Categoria);

// Índice único para evitar duplicados de nombre
CategoriaSchema.index({ nombre: 1 }, { unique: true });
