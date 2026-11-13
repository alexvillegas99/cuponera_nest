import { RateLimit } from 'src/common/security/rate-limit.guard';
import { assertClienteOPermiso, clienteDeSesion, esCliente, tienePermiso } from 'src/common/security/propiedad';
import { Auth, AuthUsuario } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators';
import { ForbiddenException } from '@nestjs/common';
// src/compartidos/compartidos.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateCompartidoDto } from './dto/create-compartido.dto';
import { CompartidosService } from './compartido.service';

@Controller('compartidos')
export class CompartidosController {
  constructor(private readonly svc: CompartidosService) {}

  @Post()
  @RateLimit(60, 15 * 60_000)
  @Auth() // va debajo: se ejecuta antes y el límite usa la sesión
  async crear(@Body() dto: CreateCompartidoDto, @GetUser() user: any) {
    // Quién comparte lo dice la sesión (solo clientes).
    (dto as any).clienteId = clienteDeSesion(user);
    return this.svc.crear(dto);
  }

  @Get('usuario/:usuarioId/resumen')
  @AuthUsuario()
  async resumen(@Param('usuarioId') usuarioId: string, @GetUser() user: any) {
    // Personal global, o el propio local (o su staff).
    const miLocal = String(user?.rol) === 'staff' && user?.usuarioCreacion ? String(user.usuarioCreacion) : String(user?._id);
    if (!tienePermiso(user, 'establecimientos.ver', 'reportes.ver') && miLocal !== String(usuarioId)) {
      throw new ForbiddenException('No puedes ver datos de otro local');
    }
    return this.svc.resumenPorUsuario(usuarioId);
  }
}
