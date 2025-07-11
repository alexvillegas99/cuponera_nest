import { Controller, Post, Body, Get, Param, Delete } from '@nestjs/common';
import { VersionCuponeraService } from './version-cuponera.service';
import { CreateVersionCuponeraDto } from './dto/create-version-cuponera.dto';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Versiones Cuponera')
@Controller('versiones')
export class VersionCuponeraController {
  constructor(private readonly versionService: VersionCuponeraService) {}

  @Post()
  create(@Body() dto: CreateVersionCuponeraDto) {
    return this.versionService.create(dto);
  }

  @Get()
  findAll() {
    return this.versionService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.versionService.findById(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.versionService.delete(id);
  }
}
