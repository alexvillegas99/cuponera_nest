import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TipoPromocionFlash {
  NUEVO_PRODUCTO = 'nuevo_producto',
  DESCUENTO = 'descuento',
  EVENTO = 'evento',
  ANUNCIO = 'anuncio',
}

export enum EstadoPromocionFlash {
  ACTIVA = 'ACTIVA',
  PAUSADA = 'PAUSADA',
  VENCIDA = 'VENCIDA',
  ELIMINADA = 'ELIMINADA',
}

export type PromocionFlashDocument = PromocionFlash & Document;

@Schema({ timestamps: true, collection: 'promociones_flash' })
export class PromocionFlash {
  /** Local dueño de la promoción (usuario admin-local). */
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true, index: true })
  usuario: Types.ObjectId;

  /** Ciudades del local (denormalizado para el feed por ubicación). */
  @Prop({ type: [Types.ObjectId], ref: 'Ciudad', default: [] })
  ciudades: Types.ObjectId[];

  @Prop({ type: String, required: true, trim: true })
  titulo: string;

  @Prop({ type: String, trim: true, default: '' })
  descripcion: string;

  @Prop({ type: String, required: true })
  imagenUrl: string;

  @Prop({
    type: String,
    enum: Object.values(TipoPromocionFlash),
    default: TipoPromocionFlash.ANUNCIO,
  })
  tipo: TipoPromocionFlash;

  /** Etiqueta corta opcional para el badge ("NUEVO", "2x1", "-30%"). */
  @Prop({ type: String, trim: true, default: null })
  etiqueta?: string;

  @Prop({ type: Number, default: null })
  precio?: number;

  @Prop({ type: Number, default: null })
  precioAntes?: number;

  @Prop({ type: Date, default: () => new Date() })
  inicia: Date;

  @Prop({ type: Date, required: true, index: true })
  vence: Date;

  @Prop({
    type: String,
    enum: Object.values(EstadoPromocionFlash),
    default: EstadoPromocionFlash.ACTIVA,
    index: true,
  })
  estado: EstadoPromocionFlash;

  // ── Canje ──────────────────────────────────────────────────────────
  /** Si es false → solo anuncio (sin canje). Si true → beneficio presencial. */
  @Prop({ type: Boolean, default: false })
  canjeable: boolean;

  /** Stock total de canjes (null = ilimitado). Solo aplica si canjeable. */
  @Prop({ type: Number, default: null })
  cupos?: number | null;

  /** Máximo de canjes por cliente. Solo aplica si canjeable. */
  @Prop({ type: Number, default: 1 })
  limitePorCliente: number;

  // ── Métricas ───────────────────────────────────────────────────────
  @Prop({ type: Number, default: 0 })
  vistas: number;

  @Prop({ type: Number, default: 0 })
  canjes: number;
}

export const PromocionFlashSchema =
  SchemaFactory.createForClass(PromocionFlash);

// Índice principal del feed del cliente.
PromocionFlashSchema.index({ ciudades: 1, estado: 1, vence: 1 });
PromocionFlashSchema.index({ usuario: 1, estado: 1 });
