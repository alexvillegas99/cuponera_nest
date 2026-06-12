import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum EstadoConversacion {
  ABIERTA = 'ABIERTA',
  CERRADA = 'CERRADA',
}

export type ConversacionDocument = Conversacion & Document;

export class UltimoMensaje {
  texto: string;
  autorId: Types.ObjectId;
  autorNombre: string;
  autorTipo: 'LOCAL' | 'SOPORTE';
  conAdjunto?: boolean;
  fecha: Date;
}

@Schema({ timestamps: true, collection: 'chat_conversaciones' })
export class Conversacion {
  /** Local dueño del hilo (admin-local). 1 hilo por local. */
  @Prop({
    type: Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true,
    index: true,
  })
  localId: Types.ObjectId;

  /** Snapshot del nombre del local para listados rápidos. */
  @Prop({ type: String, default: '' })
  localNombre: string;

  /** Snapshot del logo/avatar del local. */
  @Prop({ type: String, default: '' })
  localLogo: string;

  @Prop({ type: Object, default: null })
  ultimoMensaje: UltimoMensaje | null;

  @Prop({ type: Number, default: 0 })
  noLeidosLocal: number;

  @Prop({ type: Number, default: 0 })
  noLeidosSoporte: number;

  /** Agente del equipo asignado (manual, persistente). */
  @Prop({ type: Types.ObjectId, ref: 'Usuario', default: null })
  asignadoA: Types.ObjectId | null;

  /**
   * Agente que está atendiendo AHORA la conversación (soft-lock).
   * Se libera automáticamente si no hay actividad por 15 min.
   * Distinto de `asignadoA` (que es persistente).
   */
  @Prop({
    type: {
      userId: { type: Types.ObjectId, ref: 'Usuario' },
      nombre: String,
      ultimaActividad: Date,
    },
    default: null,
  })
  atendiendoAhora: {
    userId: Types.ObjectId;
    nombre: string;
    ultimaActividad: Date;
  } | null;

  /** Snapshot del nombre del agente asignado (mostrarlo sin populate). */
  @Prop({ type: String, default: '' })
  asignadoANombre: string;

  /**
   * Próxima escalación si el agente asignado no responde.
   * Se reinicia cuando el agente envía mensaje.
   * null = no hay escalación pendiente (sin pool o sin asignación).
   */
  @Prop({ type: Date, default: null })
  proximaEscalacion: Date | null;

  /**
   * Historial de transferencias / escalaciones. Más reciente al final.
   */
  @Prop({
    type: [
      {
        deUserId: { type: Types.ObjectId, ref: 'Usuario' },
        deNombre: String,
        paraUserId: { type: Types.ObjectId, ref: 'Usuario' },
        paraNombre: String,
        observacion: { type: String, default: '' },
        tipo: { type: String, default: 'TRANSFERENCIA' }, // TRANSFERENCIA | ESCALACION | ASIGNACION_INICIAL
        fecha: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  historialTransferencias: {
    deUserId?: Types.ObjectId;
    deNombre?: string;
    paraUserId: Types.ObjectId;
    paraNombre: string;
    observacion: string;
    tipo: 'TRANSFERENCIA' | 'ESCALACION' | 'ASIGNACION_INICIAL';
    fecha: Date;
  }[];

  @Prop({ type: [String], default: [] })
  etiquetas: string[];

  @Prop({
    type: String,
    enum: Object.values(EstadoConversacion),
    default: EstadoConversacion.ABIERTA,
    index: true,
  })
  estado: EstadoConversacion;
}

export const ConversacionSchema = SchemaFactory.createForClass(Conversacion);

ConversacionSchema.index({ estado: 1, updatedAt: -1 });
ConversacionSchema.index({ asignadoA: 1, estado: 1 });
ConversacionSchema.index({ proximaEscalacion: 1, estado: 1 });
