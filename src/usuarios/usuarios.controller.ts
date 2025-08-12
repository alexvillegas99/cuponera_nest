import { Controller, Post, Body, Get, Param, Delete, Patch } from '@nestjs/common';
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

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.usuariosService.update(id, dto);
  } 

  @Get('users-local/:id')
  findLocalById(@Param('id') id: string) {
    return this.usuariosService.buscarTodosLosUsuariosPorResponsable(id);
  }

  @Post('users-local/:id')
  createUserWithLocal(@Param('id') id: string, @Body() dto: CreateUsuarioDto) {
    return this.usuariosService.createUserWithLocal(id, dto);
  }
}
