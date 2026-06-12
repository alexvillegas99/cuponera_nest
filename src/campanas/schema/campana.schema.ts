import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum EstadoCampana {
  BORRADOR = 'BORRADOR',
  PROGRAMADA = 'PROGRAMADA',
  ENVIADA = 'ENVIADA',
  CANCELADA = 'CANCELADA',
  FALLIDA = 'FALLIDA',
}

export enum TipoSegmento {
  TODOS = 'TODOS',
  PROVINCIA = 'PROVINCIA',
  CIUDAD = 'CIUDAD',
  CATEGORIA = 'CATEGORIA',
  TOPIC = 'TOPIC',
}

export enum TipoAccion {
  NINGUNA = 'NINGUNA',
  LOCAL = 'LOCAL',
  PROMO = 'PROMO',
  FLASH = 'FLASH',
  URL = 'URL',
}

export type CampanaDocument = Campana & Document;

@Schema({ timestamps: true, collection: 'campanas' })
export class Campana {
  @Prop({ type: String, required: true, trim: true })
  titulo: string;

  @Prop({ type: String, required: true, trim: true })
  cuerpo: string;

  /** URL de imagen opcional para mostrar en el push. */
  @Prop({ type: String, default: '' })
  imagenUrl: string;

  // ── Segmentación ──────────────────────────────────────────────────
  @Prop({
    type: String,
    enum: Object.values(TipoSegmento),
    default: TipoSegmento.TODOS,
    index: true,
  })
  tipoSegmento: TipoSegmento;

  @Prop({ type: Types.ObjectId, ref: 'Provincia', default: null, index: true })
  provinciaId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Ciudad', default: null, index: true })
  ciudadId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Categoria', default: null })
  categoriaId: Types.ObjectId | null;

  /** Topic FCM directo (override). Solo para usuarios avanzados. */
  @Prop({ type: String, default: null })
  topicCustom: string | null;

  // ── Acción al tocar ───────────────────────────────────────────────
  @Prop({
    type: String,
    enum: Object.values(TipoAccion),
    default: TipoAccion.NINGUNA,
  })
  tipoAccion: TipoAccion;

  /** Referencia al recurso: Usuario (local), Cupon (promo), PromocionFlash (flash). */
  @Prop({ type: Types.ObjectId, default: null })
  accionRefId: Types.ObjectId | null;

  /** URL externa para tipoAccion = URL. */
  @Prop({ type: String, default: '' })
  accionUrl: string;

  // ── Programación / estado ─────────────────────────────────────────
  @Prop({
    type: String,
    enum: Object.values(EstadoCampana),
    default: EstadoCampana.BORRADOR,
    index: true,
  })
  estado: EstadoCampana;

  /** Fecha programada de envío. Si está en el pasado y estado=PROGRAMADA, el cron la envía. */
  @Prop({ type: Date, default: null, index: true })
  programadaPara: Date | null;

  /** Cuándo se envió realmente. */
  @Prop({ type: Date, default: null })
  enviadaEn: Date | null;

  /** Quién la creó (Usuario admin). */
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  autorId: Types.ObjectId;

  @Prop({ type: String, default: '' })
  autorNombre: string;

  // ── Métricas ──────────────────────────────────────────────────────
  @Prop({ type: Number, default: 0 })
  totalDestinatarios: number;

  @Prop({ type: Number, default: 0 })
  totalEntregadasPush: number;

  @Prop({ type: Number, default: 0 })
  totalLeidas: number;

  @Prop({ type: String, default: '' })
  errorDetalle: string;
}

export const CampanaSchema = SchemaFactory.createForClass(Campana);

CampanaSchema.index({ estado: 1, programadaPara: 1 });
CampanaSchema.index({ tipoSegmento: 1, provinciaId: 1 });
CampanaSchema.index({ createdAt: -1 });
