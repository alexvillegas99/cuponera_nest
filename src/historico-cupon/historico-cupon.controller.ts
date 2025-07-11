import { Controller, Post, Body, Get } from '@nestjs/common';
import { HistoricoCuponService } from './historico-cupon.service';
import { CreateHistoricoCuponDto } from './dto/create-historico-cupon.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Histórico de Cupones')
@Controller('historico')
export class HistoricoCuponController {
  constructor(private readonly historicoService: HistoricoCuponService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un escaneo de cupón' })
  @ApiResponse({ status: 201, description: 'Escaneo registrado correctamente' })
  @ApiResponse({ status: 400, description: 'Escaneo inválido o excede el límite' })
  registrarEscaneo(@Body() dto: CreateHistoricoCuponDto) {
    return this.historicoService.registrarEscaneo(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar historial de escaneos' })
  findAll() {
    return this.historicoService.findAll();
  }
}
