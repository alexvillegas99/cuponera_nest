# Cupones disponibles por local (consumo / anti-repetición)

Doc de referencia por si hay que ajustar la lógica de "qué cupones puede ocupar un
cliente en un local, ocultando los que ya ocupó ahí".

## Modelo de datos

- **`Cupon`** (`src/cupon/schemas/cupon.schema.ts`)
  - `cliente` → cliente dueño del cupón (quien lo puede usar).
  - `version` → versión de cuponera (define `ciudadesDisponibles`).
  - `estado` (`ACTIVO`/`INACTIVO`/`BLOQUEADO`), `numeroDeEscaneos`, `ultimoScaneo`.
- **`HistoricoCupon`** (`src/historico-cupon/schemas/historico-cupon.schema.ts`)
  - `cupon` → cupón escaneado.
  - `usuario` → **quien escaneó**. Puede ser el **admin-local** o cualquiera de su
    **staff** (cada uno con su propio `_id`). **No** es el cliente.
  - `escaneadoPor`, `fechaEscaneo`.
  - ⚠️ No existe campo `cliente` en HistoricoCupon. El vínculo al cliente está en
    `Cupon.cliente`.

## Regla de negocio

Un cupón se puede ocupar **1 sola vez por "grupo de local"** = admin-local + todos
sus usuarios staff. No es 1 vez por id de usuario.

## Registro del escaneo

`HistoricoCuponService.registrarEscaneo` (`src/historico-cupon/historico-cupon.service.ts`):

1. Calcula el grupo con `obtenerIdsUsuariosRelacionados(dto.usuario)`:
   - Si NO es staff → todos los usuarios creados por él + él mismo.
   - Si es staff → solo él.
2. Anti-duplicado: `findOne({ cupon, usuario: { $in: grupo } })`.
3. Guarda el histórico con `usuario: dto.usuario` (el id real de quien escaneó).

## Listado de disponibles (lo que ve el cliente)

`CuponService.findDisponiblesParaLocal(clienteId, usuarioId)` (`src/cupon/cupon.service.ts`):

- Endpoint: `GET /cupones/clientes/:clienteId/disponibles/:usuarioId`.
- App: `ComercioDetalleMiniScreen(usuarioId)` (cuponera_app), donde `usuarioId` es el
  `_id` del **establecimiento/admin-local**.

Pasos:
1. Toma las ciudades del local.
2. Trae los cupones `ACTIVO` del cliente.
3. **Calcula el grupo del local** (admin-local + staff) con
   `getAdminLocalRaw(usuarioId)` + `buscarTodosLosUsuariosPorResponsable(...)` y filtra
   el histórico con `usuario: { $in: idsLocal }`.
4. Excluye los cupones ya escaneados por el grupo y empata por ciudad
   (versión vs local).

## Bug corregido (2026-06-05)

Antes el paso 3 filtraba solo por `usuario: usuarioId` (un único id). La app manda el
id del **admin-local**, pero el escaneo lo pudo hacer un **staff** (histórico guardado
con el id del staff) → no coincidía y el cupón **ya ocupado seguía apareciendo
disponible**.

**Fix:** el listado ahora usa el **mismo grupo** (admin-local + staff) que el
anti-duplicado de `registrarEscaneo`. Sin migración: al desplegar, los escaneos viejos
(incluidos los de staff) se reflejan correctamente.

### Si hay que cambiar la regla en el futuro

- **1 vez por cliente en TODA la app (no por local):** filtrar el histórico por los
  cupones del cliente sin acotar por local, o agregar `cliente` a `HistoricoCupon`.
- **Permitir reusar tras X tiempo:** acotar el histórico por `fechaEscaneo` en el
  filtro de disponibles.
- Mantener SIEMPRE la coherencia: el filtro de `findDisponiblesParaLocal` debe usar el
  mismo criterio (mismo grupo / mismas fechas) que el anti-duplicado de
  `registrarEscaneo`, o vuelven a desincronizarse.
