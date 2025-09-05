// src/compartidos/compartidos.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateCompartidoDto } from './dto/create-compartido.dto';
import { CompartidosService } from './compartido.service';

@Controller('compartidos')
export class CompartidosController {
  constructor(private readonly svc: CompartidosService) {}

  @Post()
  async crear(@Body() dto: CreateCompartidoDto) {
    return this.svc.crear(dto);
  }

  @Get('usuario/:usuarioId/resumen')
  async resumen(@Param('usuarioId') usuarioId: string) {
    return this.svc.resumenPorUsuario(usuarioId);
  }
}
