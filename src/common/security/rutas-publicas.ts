/**
 * Rutas que NO exigen sesión. La prueba `rutas-protegidas.spec.ts` falla si
 * aparece una ruta sin @Auth/@AuthUsuario/@UseGuards que no esté aquí, o si
 * algo de esta lista ya no existe o ya está protegido (lista desactualizada).
 *
 * Agregar una ruta pública debe ser una decisión consciente: ponla aquí con
 * su motivo. 'fase5' = pública solo por compatibilidad con la app vieja;
 * hay que cerrarla (sesión + ámbito por dueño) en la Fase 5.
 */
type Motivo = { tipo: 'diseño' | 'fase5'; por: string };

export const RUTAS_PUBLICAS: Record<string, Motivo> = {
  // ── Sesión y registro ──
  'POST /auth/login': { tipo: 'diseño', por: 'Inicio de sesión' },
  'POST /auth/login/cliente': { tipo: 'diseño', por: 'Inicio de sesión' },
  'POST /auth/register/cliente': { tipo: 'diseño', por: 'Registro' },
  'POST /auth/account-types': { tipo: 'diseño', por: 'Elegir tipo de cuenta antes de entrar' },
  'POST /auth/google/cliente': { tipo: 'diseño', por: 'Inicio de sesión con Google' },
  'POST /auth/google/usuario': { tipo: 'diseño', por: 'Inicio de sesión con Google' },
  'POST /auth/apple/cliente': { tipo: 'diseño', por: 'Inicio de sesión con Apple' },
  'POST /auth/apple/usuario': { tipo: 'diseño', por: 'Inicio de sesión con Apple' },
  'POST /clientes': { tipo: 'diseño', por: 'Registro de cliente' },
  'GET /clientes/check-email': { tipo: 'diseño', por: 'Validar correo en el registro' },
  'POST /otps/generate': { tipo: 'diseño', por: 'OTP (limitado por cuenta)' },
  'POST /otps/verify': { tipo: 'diseño', por: 'OTP (intentos limitados)' },
  'PATCH /clientes/reset': { tipo: 'diseño', por: 'Recuperar clave: exige OTP verificado en servidor' },
  'PATCH /usuarios/reset': { tipo: 'diseño', por: 'Recuperar clave: exige OTP verificado en servidor' },
  'PATCH /usuarios/actualizar/contrasenia/recuperacion': { tipo: 'diseño', por: 'Recuperar clave: exige OTP verificado' },

  // ── Catálogos y feed públicos ──
  'GET /categorias': { tipo: 'diseño', por: 'Catálogo público' },
  'GET /categorias/:id': { tipo: 'diseño', por: 'Catálogo público' },
  'GET /categorias/activas': { tipo: 'diseño', por: 'Catálogo público' },
  'GET /ciudades': { tipo: 'diseño', por: 'Catálogo público' },
  'GET /ciudades/:id': { tipo: 'diseño', por: 'Catálogo público' },
  'GET /ciudades/promociones': { tipo: 'diseño', por: 'Catálogo público' },
  'GET /ciudades/registro': { tipo: 'diseño', por: 'Catálogo público (registro)' },
  'GET /provincias': { tipo: 'diseño', por: 'Catálogo público' },
  'GET /provincias/:id': { tipo: 'diseño', por: 'Catálogo público' },
  'GET /provincias/activas': { tipo: 'diseño', por: 'Catálogo público' },
  'GET /usuarios/promos': { tipo: 'diseño', por: 'Feed de promociones' },
  'GET /usuarios/por-ciudades': { tipo: 'diseño', por: 'Feed de promociones' },
  'GET /usuarios/por-provincia': { tipo: 'diseño', por: 'Feed de promociones' },
  'GET /usuarios/:usuarioId/detalle-mini': { tipo: 'diseño', por: 'Ficha pública del local' },
  'GET /versiones/:id/locales': { tipo: 'diseño', por: 'Locales de una cuponera (venta)' },
  'GET /versiones/buscar/nombre': { tipo: 'diseño', por: 'Buscar cuponeras a la venta' },
  'GET /versiones/buscar/paginado': { tipo: 'diseño', por: 'Cuponeras a la venta' },
  'GET /configuracion': { tipo: 'diseño', por: 'Solo lista blanca pública' },
  'GET /configuracion/:clave': { tipo: 'diseño', por: 'Solo lista blanca pública' },
  'GET /comentarios/usuario/:usuarioId': { tipo: 'diseño', por: 'Opiniones públicas de un local' },
  'GET /healthz': { tipo: 'diseño', por: 'Salud del servicio' },

  // ── Pagos (los webhooks se verifican con el proveedor) ──
  'GET /pagos/activo': { tipo: 'diseño', por: 'Método de pago disponible' },
  'GET /pagos/metodos': { tipo: 'diseño', por: 'Métodos de pago disponibles' },
  'GET /pagos/payphone/formulario': { tipo: 'diseño', por: 'Página de pago (txn validada)' },
  'GET /pagos/payphone/resultado': { tipo: 'diseño', por: 'Redirect de PayPhone (verificado)' },
  'POST /pagos/payphone/webhook': { tipo: 'diseño', por: 'Webhook (se verifica con PayPhone)' },
  'POST /pagos/webhook': { tipo: 'diseño', por: 'Webhook legado (se verifica con PayPhone)' },
  'POST /pagos/paypal/webhook': { tipo: 'diseño', por: 'Webhook (se verifica con PayPal)' },

  // ── Empresas ──
  'POST /empresas/solicitudes': { tipo: 'diseño', por: 'Formulario público de afiliación' },
  'GET /empresas/solicitudes/check-email': { tipo: 'diseño', por: 'Validar correo de afiliación' },

  // ── Pendientes Fase 5: cerrar con sesión + ámbito por dueño ──
  'GET /cupones/:id/detalle': { tipo: 'fase5', por: 'Detalle de cuponera por id de cupón' },
  'GET /cupones/agregar/:id': { tipo: 'fase5', por: 'Ver cupón físico antes de vincularlo' },
  'GET /cupones/clientes/:clienteId/cuponeras': { tipo: 'fase5', por: 'Cuponeras de un cliente por id' },
  'GET /cupones/clientes/:clienteId/cuponeras-paginado': { tipo: 'fase5', por: 'Cuponeras de un cliente por id' },
  'GET /cupones/clientes/:clienteId/disponibles/:usuarioId': { tipo: 'fase5', por: 'Cupones de un cliente por id' },
  'GET /cupones/clientes/:clienteId/locales-disponibles': { tipo: 'fase5', por: 'Locales de un cliente por id' },
  'GET /cupones/clientes/buscar/:clienteId': { tipo: 'fase5', por: 'Cupones de un cliente por id' },
  'GET /clientes/:clienteId/favorites/ids': { tipo: 'fase5', por: 'Favoritos de un cliente por id' },
  'PUT /clientes/:clienteId/favorites/:negocioId': { tipo: 'fase5', por: 'Marcar favorito de un cliente por id' },
  'POST /comentarios': { tipo: 'fase5', por: 'Opinar (tomar autor de la sesión)' },
  'GET /comentarios/eligibilidad': { tipo: 'fase5', por: 'Puede opinar' },
  'GET /comentarios/mio/:usuarioId': { tipo: 'fase5', por: 'Opinión propia por id' },
  'PUT /comentarios/mio/:usuarioId': { tipo: 'fase5', por: 'Editar opinión por id' },
  'DELETE /comentarios/mio/:usuarioId': { tipo: 'fase5', por: 'Borrar opinión por id' },
  'POST /compartidos': { tipo: 'fase5', por: 'Registrar compartido' },
  'GET /compartidos/usuario/:usuarioId/resumen': { tipo: 'fase5', por: 'Resumen de compartidos' },
  'GET /usuarios/:id': { tipo: 'fase5', por: 'Datos de un usuario (sin clave)' },
  'GET /usuarios/buscar/email/:email': { tipo: 'fase5', por: 'Permite enumerar correos del personal' },
  'GET /mail': { tipo: 'fase5', por: 'Ruta de prueba de correo: retirar' },
};
