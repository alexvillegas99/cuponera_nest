import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { VersionCuponera, VersionCuponeraDocument } from './schemas/version-cuponera.schema';
import { Model } from 'mongoose';
import { CreateVersionCuponeraDto } from './dto/create-version-cuponera.dto';

@Injectable()
export class VersionCuponeraService {
  constructor(
    @InjectModel(VersionCuponera.name)
    private readonly versionModel: Model<VersionCuponeraDocument>,
  ) {}

  async create(dto: CreateVersionCuponeraDto): Promise<VersionCuponera> {
    return this.versionModel.create(dto);
  }

  async findAll(): Promise<VersionCuponera[]> {
    return this.versionModel.find().exec();
  }

  async findById(id: string): Promise<VersionCuponera> {
    const version = await this.versionModel.findById(id).exec();
    if (!version) throw new NotFoundException('Versión de cuponera no encontrada');
    return version;
  }

  async delete(id: string): Promise<void> {
    const result = await this.versionModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Versión de cuponera no encontrada para eliminar');
  }
}
