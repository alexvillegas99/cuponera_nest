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

  /** Rol de usuario / User role */
  @Prop({ type: String, enum: RolUsuario, default: RolUsuario.STAFF })
  rol: RolUsuario;

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

  @Prop({ trim: true }) telefono?: string; // 👈 nuevo (opcional)

  @Prop() ultimaConexion?: Date;
}

export const UsuarioSchema = SchemaFactory.createForClass(Usuario);

// Índices útiles / Useful indexes

UsuarioSchema.index({ estado: 1 });
UsuarioSchema.index({ promedioCalificacion: -1 });

/** Validación de coherencia al guardar / Consistency check on save */
UsuarioSchema.pre<UsuarioDocument>('save', function (next) {
  const dp = this.detallePromocion as PromotionDetail | undefined;

  if (dp) {
    if (dp.aplicaTodosLosDias) {
      // Si aplica todos los días, limpiamos días específicos
      // If applies every day, clear specific days
      dp.diasAplicables = undefined;
    } else {
      // Si NO aplica todos los días, debe haber al menos un día
      // If NOT every day, must provide at least one day
      if (!dp.diasAplicables || dp.diasAplicables.length === 0) {
        return next(
          new Error(
            'detallePromocion.diasAplicables debe tener al menos un día cuando aplicaTodosLosDias=false',
          ),
        );
      }
    }
  }

  // Para cada promo extra, aplicamos misma coherencia
  if (Array.isArray(this.detallePromocionesExtra)) {
    for (const p of this.detallePromocionesExtra) {
      if (!p) continue;
      if (p.aplicaTodosLosDias) {
        p.diasAplicables = undefined;
      } else if (!p.diasAplicables || p.diasAplicables.length === 0) {
        return next(
          new Error(
            'detallePromocionesExtra[].diasAplicables debe tener al menos un día cuando aplicaTodosLosDias=false',
          ),
        );
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
      if (!update.$set) update.$set = {};
      // Limpiamos días si se marcó "todos los días"
      if (pathLabel === 'detallePromocion') {
        update.$set['detallePromocion.diasAplicables'] = undefined;
      }
      // Para arrays, el front debería mandar el objeto coherente ya.
    } else if (promo.aplicaTodosLosDias === false) {
      if (!promo.diasAplicables || promo.diasAplicables.length === 0) {
        return next(
          new Error(
            `${pathLabel}.diasAplicables debe tener al menos un día cuando aplicaTodosLosDias=false`,
          ),
        );
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
