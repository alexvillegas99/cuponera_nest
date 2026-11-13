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

  /** Permisos ya entregados desde roles-predefinidos.ts (ver sync-roles.ts). */
  @Prop({ type: [String], default: undefined })
  permisosSincronizados?: string[];

  /** Rol propio que comparte slug con uno predefinido: el arranque no lo toca. */
  @Prop({ type: Boolean, default: undefined })
  sinSync?: boolean;
}

export const RolSchema = SchemaFactory.createForClass(Rol);
