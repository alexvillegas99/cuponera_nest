import { Controller, Post, Body, Get, Param, Delete } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Get()
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.usuariosService.findById(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.usuariosService.delete(id);
  }
}
