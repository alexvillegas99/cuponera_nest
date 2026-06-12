import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { PromocionesFlashService } from './promociones-flash.service';
import { CreatePromocionFlashDto } from './dto/create-promocion-flash.dto';
import { UpdatePromocionFlashDto } from './dto/update-promocion-flash.dto';

const ROLES_LOCAL = ['admin-local', 'admin'];
const ROLES_VALIDA = ['admin-local', 'staff', 'admin'];

@ApiTags('Promociones Flash')
@Controller('promociones-flash')
export class PromocionesFlashController {
  constructor(private readonly service: PromocionesFlashService) {}

  private _assertRol(user: any, roles: string[]) {
    const rol = String(user?.rol || '').toLowerCase();
    if (!roles.includes(rol)) {
      throw new ForbiddenException('No tienes permiso para esta acción.');
    }
  }

  // ── Admin-local ────────────────────────────────────────────────────────────

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Crear promoción flash (máx 5 activas por local)' })
  crear(@GetUser() user: any, @Body() dto: CreatePromocionFlashDto) {
    this._assertRol(user, ROLES_LOCAL);
    return this.service.crear(String(user._id), dto);
  }

  @Get('mias')
  @Auth()
  @ApiOperation({ summary: 'Listar las promociones flash de mi local' })
  mias(@GetUser() user: any, @Query('estado') estado?: string) {
    this._assertRol(user, ROLES_LOCAL);
    return this.service.listarMias(String(user._id), estado);
  }

  @Patch(':id')
  @Auth()
  @ApiOperation({ summary: 'Actualizar / pausar una promoción flash' })
  actualizar(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePromocionFlashDto,
  ) {
    this._assertRol(user, ROLES_LOCAL);
    return this.service.actualizar(String(user._id), id, dto);
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({ summary: 'Eliminar una promoción flash' })
  eliminar(@GetUser() user: any, @Param('id') id: string) {
    this._assertRol(user, ROLES_LOCAL);
    return this.service.eliminar(String(user._id), id);
  }

  // ── Canje (staff escanea el QR del cliente) ─────────────────────────────────

  @Post('validar')
  @Auth()
  @ApiOperation({ summary: 'Validar canje de promoción flash (escaneo staff)' })
  validar(
    @GetUser() user: any,
    @Body() body: { promocionId?: string; clienteId?: string; qrData?: string },
  ) {
    this._assertRol(user, ROLES_VALIDA);
    let { promocionId, clienteId } = body;
    // Soporta QR "flash:<promocionId>:<clienteId>".
    if (body.qrData && (!promocionId || !clienteId)) {
      const parts = body.qrData.split(':');
      if (parts[0] === 'flash' && parts.length >= 3) {
        promocionId = parts[1];
        clienteId = parts[2];
      }
    }
    return this.service.validar({
      promocionId: promocionId ?? '',
      clienteId: clienteId ?? '',
      staff: user,
    });
  }

  // ── Cliente ──────────────────────────────────────────────────────────────────

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Feed de promociones flash por ciudad/provincia' })
  feed(
    @Query('ciudades') ciudades?: string,
    @Query('provincia') provincia?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.feed({
      ciudades,
      provincia,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Detalle de una promoción flash' })
  detalle(@Param('id') id: string) {
    return this.service.detalle(id);
  }

  @Post(':id/usar')
  @Auth()
  @ApiOperation({ summary: 'Cliente: usar promoción (genera QR de canje)' })
  usar(@GetUser() user: any, @Param('id') id: string) {
    return this.service.usar(String(user._id), id);
  }
}
