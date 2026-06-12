  // src/clientes/schemas/cliente.schema.ts
  import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
  import { HydratedDocument } from 'mongoose';
  import * as mongoose from 'mongoose';
  import * as bcrypt from 'bcrypt';
  export type ClienteDocument = HydratedDocument<Cliente>;

  export enum TipoIdentificacion {
    CEDULA = 'CEDULA',
    RUC = 'RUC',
    PASAPORTE = 'PASAPORTE',
  }
  @Schema({ timestamps: true, collection: 'clientes' })
  export class Cliente {
    @Prop({ type: String, required: true, trim: true })
    nombres: string;

    @Prop({ type: String, required: true, trim: true })
    apellidos: string;

    @Prop({
      type: String,
      enum: Object.values(TipoIdentificacion),
      required: true,
    })
    tipoIdentificacion: TipoIdentificacion;

    // 👇 ÚNICO
    @Prop({ type: String, required: true, index: true, trim: true })
    identificacion: string; // cédula / RUC / pasaporte

    // 👇 ÚNICO + normalizado a minúscula
    @Prop({
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    })
    email: string;

      // password hasheado (no exponer)
    @Prop({ type: String, select: false })
    password?: string;


    @Prop({ type: String }) telefono?: string;
    @Prop({ type: String }) direccion?: string;
    @Prop({ type: Date }) fechaNacimiento?: Date;
    @Prop({ type: String }) fotoUrl?: string; // foto de perfil (URL en S3)
    @Prop({ type: String, default: 'cliente' })
    rol?: string;

    @Prop({ type: String, select: false }) passwordHash?: string;

    @Prop({ type: Boolean, default: true, index: true })
    estado: boolean;

    /** Legacy: último token registrado. Mantener por compat con código viejo. */
    @Prop({ type: String })
    fcmToken?: string;

    /**
     * Tokens FCM activos del cliente, uno por dispositivo. Permite enviar
     * push a TODOS los devices logueados (login, switch, alertas seguridad).
     * Se rellena automáticamente al llamar /clientes/:id/fcm-token.
     */
    @Prop({ type: [String], default: [] })
    fcmTokens: string[];

    @Prop({ type: Boolean, default: false, index: true })
    deleted?: boolean;

    @Prop({ type: Date })
    deletedAt?: Date;

    @Prop({ type: String })
    emailOriginal?: string;

    // ── Ubicación (para segmentación de notificaciones, contenido local) ──
    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Provincia', default: null, index: true })
    provincia?: mongoose.Types.ObjectId | null;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Ciudad', default: null, index: true })
    ciudad?: mongoose.Types.ObjectId | null;

    // ── Preferencias de notificación ──
    /**
     * - push: si false → llegan silenciosas (sin sonido/banner) pero igual aparecen en la campana.
     * - promociones / nuevosLocales / actualizaciones: filtro por categoría.
     */
    @Prop({
      type: {
        push: { type: Boolean, default: true },
        promociones: { type: Boolean, default: true },
        nuevosLocales: { type: Boolean, default: true },
        actualizaciones: { type: Boolean, default: true },
      },
      default: () => ({
        push: true,
        promociones: true,
        nuevosLocales: true,
        actualizaciones: true,
      }),
    })
    prefsNotif?: {
      push: boolean;
      promociones: boolean;
      nuevosLocales: boolean;
      actualizaciones: boolean;
    };
  }

  export const ClienteSchema = SchemaFactory.createForClass(Cliente);

  // Reafirma índices únicos (útil si venías sin "unique" antes)
  ClienteSchema.index({ estado: 1, apellidos: 1 });

  // (Opcional) si prefieres unicidad por tipo+identificación en vez de global:
  // ClienteSchema.index({ tipoIdentificacion: 1, identificacion: 1 }, { unique: true });

  // Hash automático si se modifica el password
  ClienteSchema.pre('save', async function (next) {
    const doc = this as mongoose.Document & { isModified: (p: string) => boolean; password?: string; };
    if (doc.isModified('password') && doc.get('password')) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(doc.get('password'), salt);
      doc.set('password', hashed);
    }
    next();
  });
