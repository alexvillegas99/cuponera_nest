import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { Usuario, UsuarioDocument } from './schema/usuario.schema';
import { RolUsuario } from './enums/roles.enum';

@Injectable()
export class UsuariosService {
  findByEmail(email: string) {
    return this.usuarioModel.findOne({ email }).exec();
  }
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: Model<UsuarioDocument>,
  ) {}

  async create(dto: CreateUsuarioDto): Promise<Usuario> {
    //encriptar la clave antes de guardar
    //validar que no exista el email
    const existeEmail = await this.findByEmail(dto.email);
    if (existeEmail) throw new Error('El email ya está en uso');

    dto.clave = bcrypt.hashSync(dto.clave, 10);
    return this.usuarioModel.create(dto);
  }

  async findAll(): Promise<Usuario[]> {
    return this.usuarioModel.find().exec();
  }

  async findById(id: string): Promise<Usuario> {
    const usuario = await this.usuarioModel.findById(id).exec();
    if (!usuario)
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return usuario;
  }

  async delete(id: string): Promise<void> {
    await this.usuarioModel.findByIdAndDelete(id).exec();
  }

  buscarTodosLosUsuariosPorResponsable(_id: any) {
    console.log('Buscando usuarios por responsable:', _id);
    return this.usuarioModel.find({ usuarioCreacion: _id }).exec();
  }

  async update(id: string, dto: any) {
    return await this.usuarioModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
  }

  async createUserWithLocal(id: string, dto: CreateUsuarioDto) {
    const existeEmail = await this.findByEmail(dto.email);
    if (existeEmail) throw new Error('El email ya está en uso');
    dto.usuarioCreacion = id;
    dto.rol = RolUsuario.STAFF;
    dto.clave = bcrypt.hashSync(dto.clave, 10);
    return this.usuarioModel.create(dto);
  }
}
