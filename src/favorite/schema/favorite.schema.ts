// src/favorites/schemas/favorite.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({ timestamps: true, collection: 'favorites' })
export class Favorite {
  // Cliente que marca favorito
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true, index: true })
  cliente: Types.ObjectId;

  // Negocio (Usuario) que tiene la promo embebida
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true, index: true })
  negocio: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt?: Date;
}
export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Unicidad: un favorito por cliente+negocio
FavoriteSchema.index({ cliente: 1, negocio: 1 }, { unique: true });
