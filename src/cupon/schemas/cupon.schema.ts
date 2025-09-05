// src/cupones/schemas/cupon.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { VersionCuponera } from '../../version-cuponera/schemas/version-cuponera.schema';
import { EstadoCupon } from '../enum/estados_cupon';
import { Usuario } from 'src/usuarios/schema/usuario.schema';
import { Cliente } from 'src/clientes/schema/cliente.schema';

export type CuponDocument = Cupon & Document;

@Schema({ timestamps: true })
export class Cupon {
  @Prop({
    type: Types.ObjectId,
    ref: VersionCuponera.name,
    required: true,
    index: true,
  })
  version: Types.ObjectId;

  @Prop({ required: true })
  secuencial: number;

  @Prop({
    type: String,
    enum: EstadoCupon,
    default: EstadoCupon.INACTIVO,
    index: true,
  })
  estado: EstadoCupon;

  @Prop({ default: 0 })
  numeroDeEscaneos: number;

  @Prop({ required: false, default: null })
  fechaActivacion: Date;

  @Prop({ required: false, default: null })
  fechaVencimiento: Date;

  @Prop({ type: Types.ObjectId, ref: Usuario.name, required: false })
  usuarioActivador?: Types.ObjectId;

  @Prop({})

  // 👇 NUEVO: cliente dueño de esta cuponera (opcional)
  @Prop({
    type: Types.ObjectId,
    ref: Cliente.name,
    required: false,
    index: true,
  })
  cliente?: Types.ObjectId;

  @Prop({ type: Date, default: null, index: true })
  ultimoScaneo?: Date;
}

export const CuponSchema = SchemaFactory.createForClass(Cupon);

// índices útiles
CuponSchema.index({ cliente: 1, estado: 1 });
CuponSchema.index({ version: 1, cliente: 1 });
