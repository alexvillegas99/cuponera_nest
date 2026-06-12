import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HistoricoFlashDocument = HistoricoFlash & Document;

/** Registro de un canje de promoción flash (modo beneficio). */
@Schema({ timestamps: true, collection: 'historico_flash' })
export class HistoricoFlash {
  @Prop({
    type: Types.ObjectId,
    ref: 'PromocionFlash',
    required: true,
    index: true,
  })
  promocion: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true, index: true })
  cliente: Types.ObjectId;

  /** Local de la promoción. */
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  local: Types.ObjectId;

  /** Usuario (staff/admin-local) que validó el canje. */
  @Prop({ type: Types.ObjectId, ref: 'Usuario', default: null })
  validadoPor?: Types.ObjectId;

  @Prop({ type: Date, default: () => new Date() })
  fecha: Date;
}

export const HistoricoFlashSchema =
  SchemaFactory.createForClass(HistoricoFlash);

HistoricoFlashSchema.index({ promocion: 1, cliente: 1 });
