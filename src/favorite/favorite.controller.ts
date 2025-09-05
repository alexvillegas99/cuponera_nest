// src/favorites/favorites.controller.ts
import { Controller, Get, Put, Param, Query } from '@nestjs/common';
import { FavoritesService } from './favorite.service';

@Controller('clientes')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  // GET /clientes/:clienteId/favorites/ids
  @Get(':clienteId/favorites/ids')
  async myIds(@Param('clienteId') clienteId: string) {
    const ids = await this.service.listNegocioIds(clienteId);
    return { ids };
  }

  // PUT /clientes/:clienteId/favorites/:negocioId?fav=true|false
  @Put(':clienteId/favorites/:negocioId')
  async setOrToggle(
    @Param('clienteId') clienteId: string,
    @Param('negocioId') negocioId: string,
    @Query('fav') fav?: 'true' | 'false',
  ) {
    console.log(clienteId,negocioId)
  
    if (fav === 'true') {
      await this.service.add(clienteId, negocioId);
      return { isFavorite: true };
    }
    if (fav === 'false') {
      await this.service.remove(clienteId, negocioId);
      return { isFavorite: false };
    }
    // sin fav => toggle
    return this.service.toggle(clienteId, negocioId); // { isFavorite: boolean }
  }
}
