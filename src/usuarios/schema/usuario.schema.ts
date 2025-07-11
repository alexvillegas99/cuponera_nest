import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RolUsuario } from '../enums/roles.enum';

export type UsuarioDocument = Usuario & Document;

@Schema({ timestamps: true })
export class Usuario {
  @Prop({ required: true })
  nombre: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  identificacion: string; // puede ser CI o RUC

  @Prop({ type: String, enum: RolUsuario, default: RolUsuario.USUARIO })
  rol: RolUsuario;

  @Prop({ default: true })
  estado: boolean;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
