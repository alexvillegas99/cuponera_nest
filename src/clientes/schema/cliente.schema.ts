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
    @Prop({ type: String, default: 'cliente' })
    rol?: string;

    @Prop({ type: String, select: false }) passwordHash?: string;

    @Prop({ type: Boolean, default: true, index: true })
    estado: boolean;

    @Prop({ type: String })
    fcmToken?: string;

    @Prop({ type: Boolean, default: false, index: true })
    deleted?: boolean;

    @Prop({ type: Date })
    deletedAt?: Date;

    @Prop({ type: String })
    emailOriginal?: string;
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
