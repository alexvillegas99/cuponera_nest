import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { ReportesService } from './reportes.service';

@ApiTags('reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly svc: ReportesService) {}

  @Get('canjes')
  @Auth('reportes.ver')
  canjes(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('granularidad') g?: 'dia' | 'semana' | 'mes',
  ) {
    return this.svc.resumenCanjes({ desde, hasta }, g || 'dia');
  }

  @Get('ingresos')
  @Auth('reportes.ver')
  ingresos(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.svc.resumenIngresos({ desde, hasta });
  }

  @Get('locales')
  @Auth('reportes.ver')
  locales(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.rankingLocales(
      { desde, hasta },
      limit ? Number(limit) : 25,
    );
  }

  @Get('vendedores')
  @Auth('reportes.ver')
  vendedores(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.svc.productividadVendedores({ desde, hasta });
  }

  @Get('creador/:id')
  @Auth('reportes.ver')
  creador(
    @Param('id') id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.svc.detalleCreador(id, { desde, hasta });
  }

  @Get('clientes')
  @Auth('reportes.ver')
  clientes(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.svc.resumenClientes({ desde, hasta });
  }

  @Get('flash')
  @Auth('reportes.ver')
  flash(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.svc.rendimientoFlash({ desde, hasta });
  }

  @Get('solicitudes')
  @Auth('reportes.ver')
  solicitudes(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.svc.embudoSolicitudes({ desde, hasta });
  }
}
