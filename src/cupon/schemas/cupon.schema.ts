import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { VersionCuponera } from '../../version-cuponera/schemas/version-cuponera.schema';
import { EstadoCupon } from '../enum/estados_cupon';
import { Usuario } from 'src/usuarios/schema/usuario.schema';

export type CuponDocument = Cupon & Document;

@Schema({ timestamps: true })
export class Cupon {
  @Prop({ type: Types.ObjectId, ref: VersionCuponera.name, required: true })
  version: Types.ObjectId;

  @Prop({ required: true }) // secuencial como 1,2,3...
  secuencial: number;

  @Prop({ type: String, enum: EstadoCupon, default: EstadoCupon.INACTIVO })
  estado: EstadoCupon;

  @Prop({ default: 0 })
  numeroDeEscaneos: number;

  @Prop({ required: false, default: null })
  fechaActivacion: Date;

  @Prop({ required: false, default: null })
  fechaVencimiento: Date;

  @Prop({ type: Types.ObjectId, ref: Usuario.name, required: false })
  usuarioActivador?: Types.ObjectId;
}

export const CuponSchema = SchemaFactory.createForClass(Cupon);
