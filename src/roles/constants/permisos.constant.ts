export interface PermisoDefinicion {
  clave: string;
  nombre: string;
  descripcion: string;
}

export interface GrupoPermisos {
  modulo: string;
  nombre: string;
  permisos: PermisoDefinicion[];
}

export const PERMISOS_CATALOG: GrupoPermisos[] = [
  {
    modulo: 'web',
    nombre: 'Acceso Web',
    permisos: [
      { clave: 'web.acceso', nombre: 'Acceso al panel web', descripcion: 'Permite iniciar sesión en el dashboard web' },
    ],
  },
  {
    modulo: 'dashboard',
    nombre: 'Dashboard',
    permisos: [
      { clave: 'dashboard.ver', nombre: 'Ver dashboard', descripcion: 'Acceso al dashboard principal' },
    ],
  },
  {
    modulo: 'dashboard-local',
    nombre: 'Dashboard Local',
    permisos: [
      { clave: 'dashboard-local.ver', nombre: 'Ver dashboard local', descripcion: 'Acceso al dashboard de admin local' },
    ],
  },
  {
    modulo: 'usuarios-local',
    nombre: 'Usuarios Local',
    permisos: [
      { clave: 'usuarios-local.ver', nombre: 'Ver usuarios local', descripcion: 'Gestión de usuarios del establecimiento' },
    ],
  },
  {
    modulo: 'perfil-local',
    nombre: 'Perfil Local',
    permisos: [
      { clave: 'perfil-local.ver', nombre: 'Ver perfil local', descripcion: 'Acceso al perfil del establecimiento' },
    ],
  },
  {
    modulo: 'usuarios',
    nombre: 'Usuarios',
    permisos: [
      { clave: 'usuarios.ver', nombre: 'Ver usuarios', descripcion: 'Listar y ver detalle de usuarios' },
      { clave: 'usuarios.crear', nombre: 'Crear usuarios', descripcion: 'Crear nuevos usuarios' },
      { clave: 'usuarios.editar', nombre: 'Editar usuarios', descripcion: 'Modificar datos de usuarios' },
      { clave: 'usuarios.eliminar', nombre: 'Eliminar usuarios', descripcion: 'Eliminar usuarios del sistema' },
    ],
  },
  {
    modulo: 'clientes',
    nombre: 'Clientes',
    permisos: [
      { clave: 'clientes.ver', nombre: 'Ver clientes', descripcion: 'Listar y ver detalle de clientes' },
      { clave: 'clientes.editar', nombre: 'Editar clientes', descripcion: 'Modificar datos de clientes' },
    ],
  },
  {
    modulo: 'cupones',
    nombre: 'Cupones',
    permisos: [
      { clave: 'cupones.ver', nombre: 'Ver cupones', descripcion: 'Listar y ver detalle de cupones' },
      { clave: 'cupones.crear', nombre: 'Crear cupones', descripcion: 'Crear cupones individuales' },
      { clave: 'cupones.eliminar', nombre: 'Eliminar cupones', descripcion: 'Eliminar cupones' },
      { clave: 'cupones.activar', nombre: 'Activar/Desactivar cupones', descripcion: 'Cambiar estado de cupones' },
      { clave: 'cupones.lote', nombre: 'Generar lote de cupones', descripcion: 'Crear cupones en lote' },
      { clave: 'cupones.asignar', nombre: 'Asignar cupones', descripcion: 'Asignar cupones a clientes' },
    ],
  },
  {
    modulo: 'categorias',
    nombre: 'Categorías',
    permisos: [
      { clave: 'categorias.ver', nombre: 'Ver categorías', descripcion: 'Listar y ver categorías' },
      { clave: 'categorias.crear', nombre: 'Crear categorías', descripcion: 'Crear nuevas categorías' },
      { clave: 'categorias.editar', nombre: 'Editar categorías', descripcion: 'Modificar categorías' },
      { clave: 'categorias.eliminar', nombre: 'Eliminar categorías', descripcion: 'Eliminar categorías' },
      { clave: 'categorias.activar', nombre: 'Activar/Desactivar categorías', descripcion: 'Cambiar estado de categorías' },
    ],
  },
  {
    modulo: 'ciudades',
    nombre: 'Ciudades',
    permisos: [
      { clave: 'ciudades.ver', nombre: 'Ver ciudades', descripcion: 'Listar y ver ciudades' },
      { clave: 'ciudades.crear', nombre: 'Crear ciudades', descripcion: 'Crear nuevas ciudades' },
      { clave: 'ciudades.editar', nombre: 'Editar ciudades', descripcion: 'Modificar ciudades' },
      { clave: 'ciudades.eliminar', nombre: 'Eliminar ciudades', descripcion: 'Eliminar ciudades' },
      { clave: 'ciudades.activar', nombre: 'Activar/Desactivar ciudades', descripcion: 'Cambiar estado de ciudades' },
    ],
  },
  {
    modulo: 'establecimientos',
    nombre: 'Establecimientos',
    permisos: [
      { clave: 'establecimientos.ver', nombre: 'Ver establecimientos', descripcion: 'Listar y ver establecimientos' },
    ],
  },
  {
    modulo: 'reportes',
    nombre: 'Reportes',
    permisos: [
      { clave: 'reportes.ver', nombre: 'Ver reportes', descripcion: 'Acceso a reportes' },
    ],
  },
  {
    modulo: 'configuracion',
    nombre: 'Configuración',
    permisos: [
      { clave: 'configuracion.ver', nombre: 'Ver configuración', descripcion: 'Ver parámetros de configuración' },
      { clave: 'configuracion.editar', nombre: 'Editar configuración', descripcion: 'Modificar parámetros de configuración' },
      { clave: 'configuracion.eliminar', nombre: 'Eliminar configuración', descripcion: 'Eliminar parámetros de configuración' },
    ],
  },
  {
    modulo: 'solicitudes',
    nombre: 'Solicitudes',
    permisos: [
      { clave: 'solicitudes.ver', nombre: 'Ver solicitudes', descripcion: 'Listar y ver solicitudes de cuponera' },
      { clave: 'solicitudes.aprobar', nombre: 'Aprobar/Rechazar solicitudes', descripcion: 'Cambiar estado de solicitudes' },
    ],
  },
  {
    modulo: 'versiones',
    nombre: 'Versiones de Cuponera',
    permisos: [
      { clave: 'versiones.ver', nombre: 'Ver versiones', descripcion: 'Listar y ver versiones de cuponera' },
      { clave: 'versiones.crear', nombre: 'Crear versiones', descripcion: 'Crear nuevas versiones' },
      { clave: 'versiones.editar', nombre: 'Editar versiones', descripcion: 'Modificar versiones' },
      { clave: 'versiones.eliminar', nombre: 'Eliminar versiones', descripcion: 'Eliminar versiones' },
      { clave: 'versiones.activar', nombre: 'Activar/Desactivar versiones', descripcion: 'Cambiar estado de versiones' },
    ],
  },
  {
    modulo: 'historico',
    nombre: 'Histórico de Cupones',
    permisos: [
      { clave: 'historico.ver', nombre: 'Ver histórico', descripcion: 'Ver historial de escaneos' },
      { clave: 'historico.crear', nombre: 'Registrar escaneo', descripcion: 'Registrar escaneo de cupón' },
      { clave: 'historico.validar', nombre: 'Validar cupón', descripcion: 'Validar cupón antes de registro' },
    ],
  },
  {
    modulo: 'notificaciones',
    nombre: 'Notificaciones',
    permisos: [
      { clave: 'notificaciones.ver', nombre: 'Ver notificaciones', descripcion: 'Listar notificaciones' },
      { clave: 'notificaciones.enviar', nombre: 'Enviar notificaciones', descripcion: 'Enviar notificaciones push' },
    ],
  },
  {
    modulo: 'pagos',
    nombre: 'Pagos',
    permisos: [
      { clave: 'pagos.ver', nombre: 'Ver pagos', descripcion: 'Ver transacciones de pago' },
      { clave: 'pagos.configurar', nombre: 'Configurar pagos', descripcion: 'Configurar PayPhone y métodos de pago' },
    ],
  },
  {
    modulo: 'roles',
    nombre: 'Roles y Permisos',
    permisos: [
      { clave: 'roles.ver', nombre: 'Ver roles', descripcion: 'Listar y ver roles' },
      { clave: 'roles.crear', nombre: 'Crear roles', descripcion: 'Crear nuevos roles' },
      { clave: 'roles.editar', nombre: 'Editar roles', descripcion: 'Modificar roles y permisos' },
      { clave: 'roles.eliminar', nombre: 'Eliminar roles', descripcion: 'Eliminar roles personalizados' },
    ],
  },
];

/** Lista plana de todas las claves de permisos */
export const TODOS_LOS_PERMISOS: string[] = PERMISOS_CATALOG.flatMap(
  (g) => g.permisos.map((p) => p.clave),
);
