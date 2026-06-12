import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Cupon } from 'src/cupon/schemas/cupon.schema';
import { Usuario } from 'src/usuarios/schema/usuario.schema';


export type HistoricoCuponDocument = HistoricoCupon & Document;

@Schema({ timestamps: true })
export class HistoricoCupon {
  @Prop({ type: Types.ObjectId, ref: Cupon.name, required: true })
  cupon: Types.ObjectId;

  /** Admin-local responsable (usado para validación de ciudad y anti-duplicado) */
  @Prop({ type: Types.ObjectId, ref: Usuario.name, required: true })
  usuario: Types.ObjectId;

  /** Usuario que físicamente escaneó el QR (puede ser staff o el mismo admin-local) */
  @Prop({ type: Types.ObjectId, ref: Usuario.name, default: null })
  escaneadoPor: Types.ObjectId;

  @Prop({ default: Date.now })
  fechaEscaneo: Date;

  /**
   * Marca de cuándo se envió el push pidiéndole reseña al cliente. Null = aún
   * no se le pidió. Lo usa el cron de reseñas pendientes para no enviar dos
   * veces el mismo recordatorio.
   */
  @Prop({ type: Date, default: null, index: true })
  reseniaPedidaAt?: Date | null;
}

export const HistoricoCuponSchema = SchemaFactory.createForClass(HistoricoCupon);
HistoricoCuponSchema.index({ usuario: 1, cupon: 1, fechaEscaneo: -1 });
HistoricoCuponSchema.index({ cupon: 1, fechaEscaneo: -1 });   // (opcional) histórico por cupón

