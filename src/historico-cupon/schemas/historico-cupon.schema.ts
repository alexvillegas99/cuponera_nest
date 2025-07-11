import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Cupon } from 'src/cupon/schemas/cupon.schema';
import { Usuario } from 'src/usuarios/schema/usuario.schema';


export type HistoricoCuponDocument = HistoricoCupon & Document;

@Schema({ timestamps: true })
export class HistoricoCupon {
  @Prop({ type: Types.ObjectId, ref: Cupon.name, required: true })
  cupon: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Usuario.name, required: true })
  usuario: Types.ObjectId;

  @Prop({ default: new Date() })
  fechaEscaneo: Date;
}

export const HistoricoCuponSchema = SchemaFactory.createForClass(HistoricoCupon);
