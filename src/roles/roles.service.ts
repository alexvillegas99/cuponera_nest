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
   // await this.seed();
  }

  /**
   * Slugs de roles obsoletos que se eliminan en cada arranque.
   * Antes de borrar, se reasignan los usuarios afectados a un rol vigente.
   */
  private readonly ROLES_OBSOLETOS: Array<{ slug: string; reasignarA: string }> = [
    { slug: 'visualizador', reasignarA: 'staff' },
    { slug: 'mkt-fotos', reasignarA: 'marketing' },
    { slug: 'soporte', reasignarA: 'admin' },
    { slug: 'contador', reasignarA: 'admin' },
    { slug: 'supervisor', reasignarA: 'admin' },
  ];

  /** Semilla de roles por defecto — upsert para actualizar permisos en cada arranque */
  private async seed() {
    this.logger.log('Sincronizando roles por defecto...');

    const permisosAdminLocal = TODOS_LOS_PERMISOS.filter((p) => {
      const modulo = p.split('.')[0];
      return ['web', 'dashboard-local', 'usuarios-local', 'perfil-local'].includes(modulo);
    });

    const permisosStaff = TODOS_LOS_PERMISOS.filter((p) => {
      const modulo = p.split('.')[0];
      return ['dashboard-local', 'historico'].includes(modulo);
    });

    const roles = [
      // ── Sistema ──
      { nombre: 'Administrador', descripcion: 'Acceso total al sistema', permisos: [...TODOS_LOS_PERMISOS], esSistema: true, slug: 'admin' },
      { nombre: 'Admin Local', descripcion: 'Administrador de establecimiento local', permisos: permisosAdminLocal, esSistema: true, slug: 'admin-local' },
      { nombre: 'Staff', descripcion: 'Personal con acceso básico', permisos: permisosStaff, esSistema: true, slug: 'staff' },
      // ── Predefinidos ──
      {
        nombre: 'Vendedor',
        descripcion: 'Puede ver y editar solo los establecimientos que él mismo registró. Sin acceso a fotos.',
        permisos: ['web.acceso', 'establecimientos.ver', 'establecimientos.editar'],
        esSistema: false,
        slug: 'vendedor',
      },
      {
        nombre: 'Marketing',
        descripcion: 'Gestión de contenido, promociones y atención por chat',
        permisos: [
          'web.acceso', 'dashboard.ver',
          'cupones.ver', 'cupones.crear', 'cupones.lote',
          'versiones.ver', 'versiones.crear', 'versiones.editar',
          'categorias.ver', 'categorias.crear', 'categorias.editar',
          'establecimientos.ver',
          'notificaciones.ver', 'notificaciones.enviar',
          'chat.ver', 'chat.responder',
        ],
        esSistema: false,
        slug: 'marketing',
      },
    ];

    let creados = 0;
    let actualizados = 0;

    for (const rol of roles) {
      const resultado = await this.rolModel.findOneAndUpdate(
        { slug: rol.slug },
        { $set: rol },
        { upsert: true, new: true },
      ) as any;
      if (resultado.createdAt?.getTime() === resultado.updatedAt?.getTime()) {
        creados++;
      } else {
        actualizados++;
      }
    }

    this.logger.log(`Roles sincronizados: ${creados} creados, ${actualizados} actualizados`);

    await this.eliminarRolesObsoletos();
  }

  /**
   * Reasigna usuarios y borra de la BD los roles obsoletos.
   * Idempotente: si ya no existen, no hace nada.
   */
  private async eliminarRolesObsoletos() {
    const Usuario = this.rolModel.db.model('Usuario');

    for (const { slug, reasignarA } of this.ROLES_OBSOLETOS) {
      const obsoleto: any = await this.rolModel.findOne({ slug });
      if (!obsoleto) continue;

      const destino: any = await this.rolModel.findOne({ slug: reasignarA });
      if (!destino) {
        this.logger.warn(
          `Rol obsoleto "${slug}" NO eliminado: el rol destino "${reasignarA}" no existe.`,
        );
        continue;
      }

      // Reasignar usuarios que apuntan al rol obsoleto.
      const filtroRef = { rolRef: obsoleto._id };
      const filtroSlug = { rol: slug };
      const r1 = await Usuario.updateMany(filtroRef, {
        $set: { rolRef: destino._id, rol: destino.slug },
      });
      const r2 = await Usuario.updateMany(filtroSlug, {
        $set: { rolRef: destino._id, rol: destino.slug },
      });
      const reasignados = (r1.modifiedCount || 0) + (r2.modifiedCount || 0);

      await this.rolModel.deleteOne({ _id: obsoleto._id });
      this.logger.log(
        `Rol obsoleto "${slug}" eliminado. ${reasignados} usuario(s) reasignado(s) a "${reasignarA}".`,
      );
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
