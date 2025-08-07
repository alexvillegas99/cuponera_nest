import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
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

  @Prop({ type: String, enum: RolUsuario, default: RolUsuario.STAFF })
  rol: RolUsuario;

  @Prop({ required: true })
  clave: string; // Clave encriptada

  @Prop({ default: true })
  estado: boolean;
 
  @Prop({
    type: Types.ObjectId,
    ref: Usuario.name,
    required: false,
    default: null,
  })
  usuarioCreacion: Types.ObjectId;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);
