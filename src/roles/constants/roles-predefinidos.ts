import { TODOS_LOS_PERMISOS } from './permisos.constant';

/**
 * ÚNICA definición de los roles predefinidos (Fase 3).
 *
 * - Al arrancar, el backend SUMA estos permisos a cada rol (nunca quita lo que
 *   el admin personalizó desde /roles) y crea el rol si no existe.
 * - `admin` recibe siempre TODO el catálogo: un permiso nuevo le llega solo.
 * - Para dar una función nueva a otro rol, agrega aquí su permiso.
 * - `src/roles/roles-predefinidos.spec.ts` valida que todo exista en el catálogo.
 */
export interface RolPredefinido {
  slug: string;
  nombre: string;
  descripcion: string;
  permisos: string[];
}

// Lectura global: sin los permisos propios de un local (no aplican a un rol global).
const SOLO_LECTURA = TODOS_LOS_PERMISOS.filter(
  (p) => p.endsWith('.ver') && !['dashboard-local.ver', 'usuarios-local.ver', 'perfil-local.ver'].includes(p),
);

export const ROLES_PREDEFINIDOS: RolPredefinido[] = [
  {
    slug: 'admin',
    nombre: 'Administrador',
    descripcion: 'Dueños de Enjoy: acceso total',
    permisos: [...TODOS_LOS_PERMISOS],
  },
  {
    slug: 'admin-local',
    nombre: 'Admin Local',
    descripcion: 'Dueño del establecimiento',
    // Sin cupones.ver: GET /cupones no está acotado por local (vería cupones de todos).
    permisos: [
      'web.acceso', 'dashboard-local.ver', 'usuarios-local.ver', 'perfil-local.ver',
      'promociones-flash.gestionar', 'historico.ver', 'historico.crear', 'historico.validar',
    ],
  },
  {
    slug: 'staff',
    nombre: 'Staff / Cajero',
    descripcion: 'Empleado que canjea en caja (app)',
    permisos: ['dashboard-local.ver', 'historico.ver', 'historico.crear', 'historico.validar'],
  },
  {
    slug: 'vendedor',
    nombre: 'Vendedor',
    descripcion: 'Vendedor de campo: da de alta y edita locales',
    permisos: ['web.acceso', 'establecimientos.ver', 'establecimientos.crear', 'establecimientos.editar'],
  },
  {
    slug: 'marketing',
    nombre: 'Marketing',
    descripcion: 'Contenido, campañas y fotos',
    permisos: [
      'web.acceso', 'dashboard.ver',
      'cupones.ver', 'cupones.crear', 'cupones.lote',
      'versiones.ver', 'versiones.crear', 'versiones.editar',
      'categorias.ver', 'categorias.crear', 'categorias.editar',
      'establecimientos.ver', 'establecimientos.fotos',
      'notificaciones.ver', 'notificaciones.enviar',
      'chat.ver', 'chat.responder', 'promotores.ver',
    ],
  },
  {
    slug: 'atencion',
    nombre: 'Atención al cliente',
    descripcion: 'Soporte: chat, clientes y solicitudes (lectura)',
    permisos: ['web.acceso', 'chat.ver', 'chat.responder', 'clientes.ver', 'solicitudes.ver', 'establecimientos.ver', 'cupones.ver'],
  },
  {
    slug: 'finanzas',
    nombre: 'Finanzas',
    descripcion: 'Contabilidad: pagos, solicitudes y comisiones',
    permisos: ['web.acceso', 'reportes.ver', 'pagos.ver', 'solicitudes.ver', 'solicitudes.aprobar', 'promotores.ver', 'promotores.ajustar-saldo', 'clientes.ver'],
  },
  {
    slug: 'auditor',
    nombre: 'Auditor',
    descripcion: 'Revisión, solo lectura',
    permisos: ['web.acceso', ...SOLO_LECTURA],
  },
];

/**
 * Roles antiguos → rol vigente al que pasan sus usuarios (lo hace el script
 * `scripts/fase3-roles.ts`, nunca el arranque). Ninguno sube privilegios.
 */
export const ROLES_OBSOLETOS: Record<string, string> = {
  visualizador: 'auditor',
  'mkt-fotos': 'marketing',
  soporte: 'atencion',
  contador: 'finanzas',
  supervisor: 'auditor',
};

/**
 * Permisos que NUNCA debe tener un rol de local (admin-local / staff):
 * dan acceso a datos de todos los locales o a administración global.
 */
export const PERMISOS_PROHIBIDOS_PARA_LOCALES = [
  'cupones.ver', 'clientes.ver', 'usuarios.ver', 'roles.ver', 'roles.editar',
  'configuracion.ver', 'pagos.ver', 'pagos.configurar', 'solicitudes.ver',
  'solicitudes.aprobar', 'reportes.ver', 'dashboard.ver', 'establecimientos.ver',
];
