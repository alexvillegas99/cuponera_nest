// src/clientes/clientes.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { validarCedulaEc, validarRucEc } from './utils/identificacion-ec';
import * as bcrypt from 'bcrypt';
import { Cliente, ClienteDocument, TipoIdentificacion } from './schema/cliente.schema';

@Injectable()
export class ClientesService {
  constructor(
    @InjectModel(Cliente.name) private readonly clienteModel: Model<ClienteDocument>,
  ) {}

  async create(dto: CreateClienteDto) {
    const existsEmail = await this.clienteModel.exists({ email: dto.email.toLowerCase() });
    if (existsEmail) throw new BadRequestException('Email ya registrado');

    const existsId = await this.clienteModel.exists({ identificacion: dto.identificacion });
    if (existsId) throw new BadRequestException('Identificación ya registrada');

    const doc = new this.clienteModel({
      ...dto,
      email: dto.email.toLowerCase(),
      password: dto.password, // se hashea en pre-save si existe
    });
    await doc.save();
    const obj = doc.toObject();
    delete (obj as any).password;
    return obj;
  }
 async findById(id: string) {
    const c = await this.clienteModel.findById(id).lean().exec();
    if (!c) throw new NotFoundException('Cliente no encontrado');
    delete (c as any).password;
    return c;
  }

  findAll(q?: string, estado?: string) {
    const filter: any = {};
    if (q) {
      filter.$or = [
        { nombres: new RegExp(q, 'i') },
        { apellidos: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { identificacion: new RegExp(q, 'i') },
      ];
    }
    if (estado !== undefined) filter.estado = estado === 'true';
    return this.clienteModel.find(filter).limit(100).lean();
  }

  async findByEmail(email: string, withPassword = false) {
    const q = this.clienteModel.findOne({ email: email.toLowerCase() });
    if (withPassword) q.select('+password');
    return q.lean().exec();
  }

 async validatePassword(plain: string, hashed?: string) {
    return hashed ? bcrypt.compare(plain, hashed) : false;
  }

}
