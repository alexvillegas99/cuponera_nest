import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { Usuario, UsuarioDocument } from './schema/usuario.schema';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: Model<UsuarioDocument>,
  ) {}

  async create(dto: CreateUsuarioDto): Promise<Usuario> {
    return this.usuarioModel.create(dto);
  }

  async findAll(): Promise<Usuario[]> {
    return this.usuarioModel.find().exec();
  }

 async findById(id: string): Promise<Usuario> {
  const usuario = await this.usuarioModel.findById(id).exec();
  if (!usuario) throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
  return usuario;
}

  async delete(id: string): Promise<void> {
    await this.usuarioModel.findByIdAndDelete(id).exec();
  }
}
