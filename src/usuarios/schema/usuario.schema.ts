import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RolUsuario } from '../enums/roles.enum';

export type UsuarioDocument = Usuario & Document;

/** Día de la semana (ES / EN) */
export type DiaSemana =
  | 'lunes' // Monday
  | 'martes' // Tuesday
  | 'miercoles' // Wednesday
  | 'jueves' // Thursday
  | 'viernes' // Friday
  | 'sabado' // Saturday
  | 'domingo'; // Sunday

/** Tipo de medio de la galería / Gallery media type */
export type MediaType = 'image' | 'video';

/**
 * Item de galería del local (foto o video) / Venue gallery item (photo or video)
 * Los videos solo se reproducen al entrar al detalle del establecimiento.
 */
@Schema({ _id: false })
export class MediaItem {
  /** URL final en S3 / Final S3 URL */
  @Prop() url?: string;

  /** Tipo de medio / Media type */
  @Prop({ type: String, enum: ['image', 'video'], default: 'image' })
  type?: MediaType;

  /** Poster/miniatura opcional del video / Optional video poster */
  @Prop() thumbnailUrl?: string;
}
export const MediaItemSchema = SchemaFactory.createForClass(MediaItem);

/**
 * Item del catálogo del local (producto/servicio) / Venue catalog item (product/service)
 * Genérico: aplica a cualquier rubro. Cada item es una foto con nombre y descripción.
 */
@Schema({ _id: false })
export class ProductoItem {
  /** URL final en S3 / Final S3 URL */
  @Prop() url?: string;

  /** Nombre del producto / Product name */
  @Prop() nombre?: string;

  /** Descripción del producto / Product description */
  @Prop() descripcion?: string;
}
export const ProductoItemSchema = SchemaFactory.createForClass(ProductoItem);

/** Subdocumento con el detalle de una promoción (todo opcional) */
@Schema({ _id: false })
export class PromotionDetail {
  /** ID interno de la promoción (opcional) / Promotion internal id (optional) */
  @Prop() id?: string;

  /** Título de la promoción / Promotion title */
  @Prop() title?: string;

  /** Nombre del local / Place (venue) name */
  @Prop() placeName?: string;

  /** Descripción / Description */
  @Prop() description?: string;

  /** URL de imagen principal / Main image URL */
  @Prop() imageUrl?: string;

  /** URL de logo / Logo URL */
  @Prop() logoUrl?: string;

  /**
   * Galería del local: hasta 5 fotos o videos / Venue gallery: up to 5 photos or videos
   * No reemplaza a imageUrl (que se mantiene por compatibilidad). Los videos solo se
   * reproducen al entrar al detalle del establecimiento.
   */
  @Prop({
    type: [MediaItemSchema],
    default: undefined,
    validate: {
      validator: (v?: MediaItem[]) => !v || v.length <= 5,
      message: 'galeria admite máximo 5 elementos',
    },
  })
  galeria?: MediaItem[];

  /**
   * Catálogo del local: productos/servicios que ofrece, sin límite de cantidad.
   * Venue catalog: products/services offered, no quantity limit. Genérico (no solo comida).
   */
  @Prop({ type: [ProductoItemSchema], default: undefined })
  productos?: ProductoItem[];

  /** ¿Es 2x1? / Is two-for-one? */
  @Prop() isTwoForOne?: boolean;

  /** Etiquetas / Tags */
  @Prop({ type: [String], default: undefined }) tags?: string[];

  /** Calificación (0-5) / Rating (0-5) */
  @Prop() rating?: number;

  /**
   * Etiqueta de horario para mostrar (texto) / Display schedule label (free text)
   * Ej: "Lun-Dom 10:00–19:00" / e.g., "Mon-Sun 10:00–19:00"
   * (Opcional; puedes seguir usándolo como resumen visible)
   */
  @Prop() scheduleLabel?: string;

  /** Distancia (texto) / Distance label (text) */
  @Prop() distanceLabel?: string;

  /** Inicio de vigencia / Valid from */
  @Prop() startDate?: Date;

  /** Fin de vigencia / Valid until */
  @Prop() endDate?: Date;

  /** ¿Es flash (tiempo limitado)? / Is flash promo? */
  @Prop() isFlash?: boolean;

  /** Dirección del local / Venue address */
  @Prop() address?: string;

  // ────────────────────────────────────────────────────────────────────────────
  // DISPONIBILIDAD POR DÍAS Y HORARIOS
  // (solo almacenamos horarios; el front decide si hoy aplica)
  // Availability by weekdays and time ranges
  // (we only store schedules; the frontend decides if today applies)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * ¿Aplica todos los días? / Applies every day?
   * Si true ⇒ puedes omitir `diasAplicables` y `horarioPorDia`
   * If true ⇒ you may omit `diasAplicables` and `horarioPorDia`
   */
  @Prop({ default: true })
  aplicaTodosLosDias?: boolean;

  /**
   * Días aplicables cuando NO es todos los días / Applicable weekdays when not every day
   * Valores permitidos (ES / EN):
   *  - "lunes" (Monday), "martes" (Tuesday), "miercoles" (Wednesday), "jueves" (Thursday),
   *    "viernes" (Friday), "sabado" (Saturday), "domingo" (Sunday)
   */
  @Prop({
    type: [String],
    enum: [
      'lunes',
      'martes',
      'miercoles',
      'jueves',
      'viernes',
      'sabado',
      'domingo',
    ],
    default: undefined,
  })
  diasAplicables?: DiaSemana[];

  /**
   * Horario por día (opcional) / Per-day time ranges (optional)
   * Estructura / Structure:
   * {
   *   lunes:    { abre: "10:00", cierra: "19:00" },
   *   martes:   { abre: "10:00", cierra: "19:00" },
   *   ...
   * }
   * Formato recomendado HH:mm (24h) / Recommended format HH:mm (24h)
   */
  @Prop({ type: Object, required: false })
  horarioPorDia?: Partial<Record<DiaSemana, { abre: string; cierra: string }>>;

  /**
   * Fechas específicas EXCLUIDAS (no aplica) / Explicit excluded dates (no promo)
   * Útil para feriados o cierres / Useful for holidays or closures
   */
  @Prop({ type: [Date], default: [] })
  fechasExcluidas?: Date[];
}
export const PromotionDetailSchema =
  SchemaFactory.createForClass(PromotionDetail);

@Schema({ timestamps: true })
export class Usuario {
  /** Nombre del usuario / User full name */
  @Prop({ required: true }) nombre: string;

  /** Email (único) / Email (unique) */
  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  })
  email: string;

  /** Identificación (CI/RUC) / National ID (CI/RUC) */
  @Prop({ required: true, trim: true })
  identificacion: string;

  /** Rol de usuario (slug del rol dinámico) */
  @Prop({ type: String, default: RolUsuario.STAFF })
  rol: string;

  /** Referencia al rol dinámico / Dynamic role reference */
  @Prop({ type: Types.ObjectId, ref: 'Rol', default: null })
  rolRef: Types.ObjectId;

  /** Clave hash (bcrypt) / Password hash */
  @Prop({ required: true }) clave: string;

  /** Estado activo / Active flag */
  @Prop({ default: true }) estado: boolean;

  /** Usuario que creó este registro (responsable) / Creator user (responsible) */
  @Prop({ type: Types.ObjectId, ref: Usuario.name, default: null })
  usuarioCreacion: Types.ObjectId;

  // ── Relaciones ── / Relations
  /** Ciudades asignadas (ObjectId -> Ciudad) / Assigned cities */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Ciudad' }], default: [] })
  ciudades: Types.ObjectId[];

  /** Categorías asignadas (ObjectId -> Categoria) / Assigned categories */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Categoria' }], default: [] })
  categorias: Types.ObjectId[];

  /** Detalle de promoción / Promotion detail */
  @Prop({ type: PromotionDetailSchema, required: false })
  detallePromocion?: PromotionDetail;

  /** Lista de promos extra / Additional promotion details */
  @Prop({ type: PromotionDetailSchema, default: null })
  detallePromocionesExtra?: PromotionDetail;

  /** Promedio de calificación (1-5) */
  @Prop({ default: 0 })
  promedioCalificacion: number;

  /** Número total de comentarios recibidos */
  @Prop({ default: 0 })
  totalComentarios: number;

  @Prop({ trim: true }) telefono?: string;

  @Prop() ultimaConexion?: Date;

  @Prop({ type: String }) fcmToken?: string;

  /** Geolocalización del local { lat, lng } */
  @Prop({ 
    type: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    required: false,
    default: null,
  })
  ubicacion?: { lat: number; lng: number } | null;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);

// Índices útiles / Useful indexes

UsuarioSchema.index({ estado: 1 });
UsuarioSchema.index({ promedioCalificacion: -1 });

/** Validación de coherencia al guardar / Consistency check on save */
UsuarioSchema.pre<UsuarioDocument>('save', function (next) {
  const dp = this.detallePromocion as PromotionDetail | undefined;

  // Coherencia: en vez de fallar, AUTO-CORREGIMOS para no bloquear el guardado
  // (permite guardar secciones sueltas sin exigir días/horarios completos).
  if (dp) {
    if (dp.aplicaTodosLosDias) {
      dp.diasAplicables = undefined;
    } else if (!dp.diasAplicables || dp.diasAplicables.length === 0) {
      // Inconsistente → tratar como "aplica todos los días"
      dp.aplicaTodosLosDias = true;
      dp.diasAplicables = undefined;
    }
  }

  if (Array.isArray(this.detallePromocionesExtra)) {
    for (const p of this.detallePromocionesExtra) {
      if (!p) continue;
      if (p.aplicaTodosLosDias) {
        p.diasAplicables = undefined;
      } else if (!p.diasAplicables || p.diasAplicables.length === 0) {
        p.aplicaTodosLosDias = true;
        p.diasAplicables = undefined;
      }
    }
  }

  next();
});

/** Misma validación en updates / Same check for updates */
UsuarioSchema.pre<any>('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;
  if (!update) return next();

  // Cuando viene con $set / direct assign
  const dp = update.detallePromocion ?? update.$set?.detallePromocion;
  const list =
    update.detallePromocionesExtra ?? update.$set?.detallePromocionesExtra;

  const ensure = (promo: any, pathLabel: string) => {
    if (!promo) return;
    if (promo.aplicaTodosLosDias === true) {
      if (pathLabel === 'detallePromocion') {
        promo.diasAplicables = undefined;
      }
    } else if (promo.aplicaTodosLosDias === false) {
      if (!promo.diasAplicables || promo.diasAplicables.length === 0) {
        // AUTO-CORREGIR en vez de fallar: no bloquear el guardado por sección.
        promo.aplicaTodosLosDias = true;
        promo.diasAplicables = undefined;
      }
    }
  };

  ensure(dp, 'detallePromocion');

  if (Array.isArray(list)) {
    for (let i = 0; i < list.length; i++) {
      ensure(list[i], `detallePromocionesExtra[${i}]`);
    }
  }

  next();
});
