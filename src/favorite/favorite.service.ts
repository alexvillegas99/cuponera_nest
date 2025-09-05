// src/favorites/favorites.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite, FavoriteDocument } from './schema/favorite.schema';

@Injectable()
export class FavoritesService {
  constructor(@InjectModel(Favorite.name) private favModel: Model<FavoriteDocument>) {}

  /** IDs de negocios favoritos del cliente */
  async listNegocioIds(clienteId: string): Promise<string[]> {
    const rows = await this.favModel
      .find({ cliente: new Types.ObjectId(clienteId) })
      .select('negocio')
      .lean();
    return rows.map(r => String(r.negocio));
  }

  /** Agregar favorito (idempotencia por índice único) */
  async add(clienteId: string, negocioId: string) {
    try {
      return await this.favModel.create({
        cliente: new Types.ObjectId(clienteId),
        negocio: new Types.ObjectId(negocioId),
      });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Already favorite');
      throw e;
    }
  }

  /** Quitar favorito */
  async remove(clienteId: string, negocioId: string) {
    const res = await this.favModel.findOneAndDelete({
      cliente: new Types.ObjectId(clienteId),
      negocio: new Types.ObjectId(negocioId),
    });
    if (!res) throw new NotFoundException('Favorite not found');
    return res;
  }

  /** Toggle favorito → { isFavorite: boolean } */
  async toggle(clienteId: string, negocioId: string) {
    const existing = await this.favModel.findOne({
      cliente: new Types.ObjectId(clienteId),
      negocio: new Types.ObjectId(negocioId),
    });

    if (existing) {
      await existing.deleteOne();
      return { isFavorite: false };
    } else {
      await this.add(clienteId, negocioId);
      return { isFavorite: true };
    }
  }

  /** (Opcional) Traer detalle de negocios favoritos poblados */
  async listFavoritosDetalle(clienteId: string) {
    const rows = await this.favModel
      .find({ cliente: new Types.ObjectId(clienteId) })
      .populate('negocio') // <- Usuario con detallePromocion embebido
      .lean();

    // Devuelve array de negocios (Usuarios)
    return rows.map(r => r.negocio);
  }
}
