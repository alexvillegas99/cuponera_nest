import { ROLES_PREDEFINIDOS } from './constants/roles-predefinidos';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rol, RolDocument } from './schema/rol.schema';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';
import {
  PERMISOS_CATALOG,
  TODOS_LOS_PERMISOS,
} from './constants/permisos.constant';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectModel(Rol.name) private readonly rolModel: Model<RolDocument>,
  ) {}

  async onModuleInit() {
    await this._sincronizarRolesPredefinidos();
  }

  /**
   * Sincroniza los roles predefinidos (constants/roles-predefinidos.ts):
   * crea los que falten y SUMA permisos con $addToSet — nunca quita lo que el
   * admin personalizó desde /roles. Así una función nueva llega a los roles
   * que la necesitan con solo agregar su permiso a la constante.
   * La reasignación de roles obsoletos la hace el script de la Fase 3.
   */
  private async _sincronizarRolesPredefinidos() {
    for (const r of ROLES_PREDEFINIDOS) {
      const permisos = r.permisos.filter((p) => TODOS_LOS_PERMISOS.includes(p));
      try {
        await this.rolModel.updateOne(
          { slug: r.slug },
          {
            $addToSet: { permisos: { $each: permisos } },
            $setOnInsert: { slug: r.slug, nombre: r.nombre, descripcion: r.descripcion, esSistema: true },
          },
          { upsert: true },
        );
      } catch (e: any) {
        this.logger.warn(`Sync del rol "${r.slug}" falló: ${e?.message}`);
      }
    }
  }

  async create(dto: CreateRolDto) {
    if (!dto.slug) {
      dto.slug = dto.nombre
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
    }

    const existe = await this.rolModel.findOne({ slug: dto.slug });
    if (existe) {
      throw new BadRequestException(`Ya existe un rol con el slug "${dto.slug}"`);
    }

    return this.rolModel.create(dto);
  }

  async findAll() {
    return this.rolModel.find().sort({ esSistema: -1, nombre: 1 });
  }

  async findById(id: string) {
    const rol = await this.rolModel.findById(id);
    if (!rol) throw new NotFoundException('Rol no encontrado');
    return rol;
  }

  async findBySlug(slug: string): Promise<RolDocument | null> {
    return this.rolModel.findOne({ slug });
  }

  async update(id: string, dto: UpdateRolDto) {
    const rol = await this.findById(id);

    if (rol.esSistema && dto.slug && dto.slug !== rol.slug) {
      throw new BadRequestException('No se puede cambiar el slug de un rol de sistema');
    }

    return this.rolModel.findByIdAndUpdate(id, dto, { new: true });
  }

  async delete(id: string) {
    const rol = await this.findById(id);

    if (rol.esSistema) {
      throw new BadRequestException('No se puede eliminar un rol de sistema');
    }

    await this.rolModel.findByIdAndDelete(id);
    return { ok: true };
  }

  /** Retorna la lista maestra de permisos agrupados */
  getPermisosCatalog() {
    return PERMISOS_CATALOG;
  }

  /** Resuelve los permisos de un usuario a partir de su rol string (slug) */
  async getPermisosForUsuario(usuario: any): Promise<string[]> {
    // Si tiene rolRef poblado, usar esos permisos
    if (usuario.rolRef && typeof usuario.rolRef === 'object' && usuario.rolRef.permisos) {
      return usuario.rolRef.permisos;
    }

    // Fallback: buscar por slug del campo rol string
    if (usuario.rol) {
      const rol = await this.findBySlug(usuario.rol);
      if (rol) return rol.permisos;
    }

    return [];
  }
}
