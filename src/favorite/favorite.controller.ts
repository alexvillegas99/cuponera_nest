import { assertClienteOPermiso, clienteDeSesion, esCliente, tienePermiso } from 'src/common/security/propiedad';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators';
import { ForbiddenException } from '@nestjs/common';
// src/favorites/favorites.controller.ts
import { Controller, Get, Put, Param, Query } from '@nestjs/common';
import { FavoritesService } from './favorite.service';

@Controller('clientes')
export class FavoritesController {
  constructor(private readonly service: FavoritesService) {}

  // GET /clientes/:clienteId/favorites/ids
  @Get(':clienteId/favorites/ids')
  @Auth()
  async myIds(@Param('clienteId') clienteId: string, @GetUser() user: any) {
    assertClienteOPermiso(user, clienteId, 'clientes.ver');
    const ids = await this.service.listNegocioIds(clienteId);
    return { ids };
  }

  // PUT /clientes/:clienteId/favorites/:negocioId?fav=true|false
  @Put(':clienteId/favorites/:negocioId')
  @Auth()
  async setOrToggle(
    @GetUser() user: any,
    @Param('clienteId') clienteId: string,
    @Param('negocioId') negocioId: string,
    @Query('fav') fav?: 'true' | 'false',
  ) {
    if (clienteDeSesion(user) !== String(clienteId)) throw new ForbiddenException('Solo puedes cambiar tus favoritos');
  
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
