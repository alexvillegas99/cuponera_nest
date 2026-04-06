import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditoriaDocument = Auditoria & Document;

@Schema({ timestamps: true, collection: 'auditoria' })
export class Auditoria {
  /** Acción realizada (ej: 'usuario.crear', 'rol.editar', 'solicitud.aprobar') */
  @Prop({ required: true, index: true })
  accion: string;

  /** Módulo al que pertenece (ej: 'usuarios', 'roles', 'cupones') */
  @Prop({ required: true, index: true })
  modulo: string;

  /** Descripción legible de la acción */
  @Prop({ required: true })
  descripcion: string;

  /** ID del usuario que realizó la acción */
  @Prop({ type: Types.ObjectId, ref: 'Usuario', default: null })
  usuarioId: Types.ObjectId;

  /** Nombre del usuario (snapshot para no depender de populate) */
  @Prop({ default: '' })
  usuarioNombre: string;

  /** Email del usuario */
  @Prop({ default: '' })
  usuarioEmail: string;

  /** ID del recurso afectado (usuario, rol, cupón, etc.) */
  @Prop({ default: null })
  recursoId: string;

  /** Tipo de recurso (ej: 'Usuario', 'Rol', 'Cupon') */
  @Prop({ default: '' })
  recursoTipo: string;

  /** Datos anteriores (para ediciones) */
  @Prop({ type: Object, default: null })
  datosAnteriores: Record<string, any>;

  /** Datos nuevos */
  @Prop({ type: Object, default: null })
  datosNuevos: Record<string, any>;

  /** IP desde donde se realizó */
  @Prop({ default: '' })
  ip: string;

  /** Nivel de severidad */
  @Prop({ default: 'info', enum: ['info', 'warning', 'critical'] })
  severidad: string;
}

export const AuditoriaSchema = SchemaFactory.createForClass(Auditoria);

AuditoriaSchema.index({ createdAt: -1 });
AuditoriaSchema.index({ modulo: 1, accion: 1 });
AuditoriaSchema.index({ usuarioId: 1 });
