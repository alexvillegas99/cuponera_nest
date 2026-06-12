import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CampanaEntregaDocument = CampanaEntrega & Document;

/**
 * Una entrada por cliente que debe ver la campaña en su bandeja in-app.
 * Se crea al ENVIAR la campaña (fan-out al segmento).
 */
@Schema({ timestamps: true, collection: 'campanas_entregas' })
export class CampanaEntrega {
  @Prop({
    type: Types.ObjectId,
    ref: 'Campana',
    required: true,
    index: true,
  })
  campanaId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Cliente',
    required: true,
    index: true,
  })
  clienteId: Types.ObjectId;

  /** Snapshot del contenido al momento de enviar (para no perderlo si se borra la campaña). */
  @Prop({ type: String, default: '' })
  titulo: string;

  @Prop({ type: String, default: '' })
  cuerpo: string;

  @Prop({ type: String, default: '' })
  imagenUrl: string;

  @Prop({ type: String, default: 'NINGUNA' })
  tipoAccion: string;

  @Prop({ type: Types.ObjectId, default: null })
  accionRefId: Types.ObjectId | null;

  @Prop({ type: String, default: '' })
  accionUrl: string;

  // ── Estado de entrega/lectura ─────────────────────────────────────
  @Prop({ type: Boolean, default: false, index: true })
  leida: boolean;

  @Prop({ type: Date, default: null })
  leidaEn: Date | null;

  /** Si el push se envió silencioso (porque el usuario lo tiene desactivado). */
  @Prop({ type: Boolean, default: false })
  pushSilencioso: boolean;
}

export const CampanaEntregaSchema =
  SchemaFactory.createForClass(CampanaEntrega);

// Una entrada por cliente y campaña (sin duplicados).
CampanaEntregaSchema.index({ campanaId: 1, clienteId: 1 }, { unique: true });
CampanaEntregaSchema.index({ clienteId: 1, leida: 1, createdAt: -1 });
