import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HistoricoCupon } from '../historico-cupon/schemas/historico-cupon.schema';
import { Usuario } from '../usuarios/schema/usuario.schema';
import { Cliente } from '../clientes/schema/cliente.schema';
import { Pago } from '../pagos/schema/pago.schema';
import { SolicitudCuponera } from '../solicitud-cuponera/schema/solicitud-cuponera.schema';
// `PromocionFlash` y `HistoricoFlash` se inyectan por nombre.
import { Cupon } from '../cupon/schemas/cupon.schema';

export interface RangoFechas {
  desde?: string; // ISO
  hasta?: string;
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectModel(HistoricoCupon.name)
    private readonly historicoModel: Model<any>,
    @InjectModel(Usuario.name) private readonly usuarioModel: Model<any>,
    @InjectModel(Cliente.name) private readonly clienteModel: Model<any>,
    @InjectModel(Pago.name) private readonly pagoModel: Model<any>,
    @InjectModel(SolicitudCuponera.name)
    private readonly solicitudModel: Model<any>,
    @InjectModel('PromocionFlash') private readonly flashModel: Model<any>,
    @InjectModel('HistoricoFlash')
    private readonly historicoFlashModel: Model<any>,
    @InjectModel(Cupon.name) private readonly cuponModel: Model<any>,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────
  private rango(r: RangoFechas): { desde: Date; hasta: Date } {
    // Default: últimos 90 días (cubre meses con poca actividad reciente).
    // El cliente puede pisarlo desde la UI.
    const hasta = r.hasta ? new Date(r.hasta) : new Date();
    // El "hasta" debe incluir todo el día (23:59:59).
    if (r.hasta) {
      hasta.setHours(23, 59, 59, 999);
    }
    const desde = r.desde
      ? new Date(r.desde)
      : new Date(hasta.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (r.desde) desde.setHours(0, 0, 0, 0);
    return { desde, hasta };
  }

  private fmtFecha(d: Date, granularidad: 'dia' | 'semana' | 'mes'): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    if (granularidad === 'dia') return `${y}-${m}-${day}`;
    if (granularidad === 'semana') {
      const startOfYear = new Date(Date.UTC(y, 0, 1));
      const weekNum = Math.ceil(
        ((d.getTime() - startOfYear.getTime()) / 86400000 +
          startOfYear.getUTCDay() +
          1) /
          7,
      );
      return `${y}-W${String(weekNum).padStart(2, '0')}`;
    }
    return `${y}-${m}`;
  }

  // ── 1) CANJES + INGRESOS ────────────────────────────────────────────
  async resumenCanjes(r: RangoFechas, granularidad: 'dia' | 'semana' | 'mes' = 'dia') {
    const { desde, hasta } = this.rango(r);

    // Serie temporal de canjes
    const groupByExpr =
      granularidad === 'dia'
        ? {
            $dateToString: { format: '%Y-%m-%d', date: '$fechaEscaneo' },
          }
        : granularidad === 'mes'
        ? { $dateToString: { format: '%Y-%m', date: '$fechaEscaneo' } }
        : {
            $concat: [
              { $toString: { $year: '$fechaEscaneo' } },
              '-W',
              {
                $toString: {
                  $isoWeek: '$fechaEscaneo',
                },
              },
            ],
          };

    const serie = await this.historicoModel.aggregate([
      { $match: { fechaEscaneo: { $gte: desde, $lte: hasta } } },
      { $group: { _id: groupByExpr, total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const totalCanjes = serie.reduce((acc, s) => acc + s.total, 0);

    // Top 10 locales
    const topLocales = await this.historicoModel.aggregate([
      { $match: { fechaEscaneo: { $gte: desde, $lte: hasta } } },
      { $group: { _id: '$usuario', canjes: { $sum: 1 } } },
      { $sort: { canjes: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'usuarios',
          localField: '_id',
          foreignField: '_id',
          as: 'local',
        },
      },
      { $unwind: '$local' },
      {
        $project: {
          _id: 0,
          localId: '$_id',
          nombre: '$local.nombre',
          email: '$local.email',
          canjes: 1,
        },
      },
    ]);

    // Top 5 horas del día
    const porHora = await this.historicoModel.aggregate([
      { $match: { fechaEscaneo: { $gte: desde, $lte: hasta } } },
      {
        $group: {
          _id: { $hour: '$fechaEscaneo' },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      rango: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      totalCanjes,
      serie: serie.map((s) => ({ fecha: s._id, canjes: s.total })),
      topLocales,
      porHora: porHora.map((h) => ({ hora: h._id, canjes: h.total })),
    };
  }

  async resumenIngresos(r: RangoFechas) {
    const { desde, hasta } = this.rango(r);

    // Solo pagos aprobados. Campos del schema Pago: status, metodo, fechaPago.
    const matchOk: any = {
      createdAt: { $gte: desde, $lte: hasta },
      status: 'APROBADO',
    };

    const total = await this.pagoModel.aggregate([
      { $match: matchOk },
      {
        $group: {
          _id: null,
          ingresoTotal: { $sum: '$monto' },
          ventas: { $sum: 1 },
        },
      },
    ]);

    const porMetodo = await this.pagoModel.aggregate([
      { $match: matchOk },
      {
        $group: {
          _id: '$metodo',
          monto: { $sum: '$monto' },
          ventas: { $sum: 1 },
        },
      },
      { $sort: { monto: -1 } },
    ]);

    const serieDiaria = await this.pagoModel.aggregate([
      { $match: matchOk },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          monto: { $sum: '$monto' },
          ventas: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      rango: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      total: total[0]?.ingresoTotal || 0,
      ventas: total[0]?.ventas || 0,
      ticketPromedio:
        total[0]?.ventas > 0 ? (total[0].ingresoTotal || 0) / total[0].ventas : 0,
      porMetodo: porMetodo.map((m) => ({
        metodo: m._id || 'desconocido',
        monto: m.monto,
        ventas: m.ventas,
      })),
      serie: serieDiaria.map((s) => ({
        fecha: s._id,
        monto: s.monto,
        ventas: s.ventas,
      })),
    };
  }

  // ── 2) LOCALES + VENDEDORES ────────────────────────────────────────
  async rankingLocales(r: RangoFechas, limit = 25) {
    const { desde, hasta } = this.rango(r);

    const ranking = await this.historicoModel.aggregate([
      { $match: { fechaEscaneo: { $gte: desde, $lte: hasta } } },
      { $group: { _id: '$usuario', canjes: { $sum: 1 } } },
      { $sort: { canjes: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'usuarios',
          localField: '_id',
          foreignField: '_id',
          as: 'local',
        },
      },
      { $unwind: '$local' },
      {
        $lookup: {
          from: 'ciudades',
          localField: 'local.ciudades',
          foreignField: '_id',
          as: 'ciudades',
        },
      },
      {
        $lookup: {
          from: 'categorias',
          localField: 'local.categorias',
          foreignField: '_id',
          as: 'categorias',
        },
      },
      {
        $project: {
          _id: 0,
          localId: '$_id',
          nombre: '$local.nombre',
          email: '$local.email',
          estado: '$local.estado',
          calificacion: '$local.promedioCalificacion',
          ciudad: { $arrayElemAt: ['$ciudades.nombre', 0] },
          categoria: { $arrayElemAt: ['$categorias.nombre', 0] },
          canjes: 1,
        },
      },
    ]);

    // Resumen general
    const total = await this.usuarioModel.countDocuments({ rol: 'admin-local' });
    const activos = await this.usuarioModel.countDocuments({
      rol: 'admin-local',
      estado: true,
    });

    const porProvincia = await this.usuarioModel.aggregate([
      { $match: { rol: 'admin-local' } },
      {
        $lookup: {
          from: 'ciudades',
          localField: 'ciudades',
          foreignField: '_id',
          as: 'ciudades',
        },
      },
      { $unwind: { path: '$ciudades', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'provincias',
          localField: 'ciudades.provincia',
          foreignField: '_id',
          as: 'provincia',
        },
      },
      { $unwind: { path: '$provincia', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$provincia.nombre',
          total: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return {
      rango: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      total,
      activos,
      inactivos: total - activos,
      porProvincia: porProvincia.map((p) => ({
        provincia: p._id || 'Sin provincia',
        total: p.total,
      })),
      ranking,
    };
  }

  async productividadVendedores(r: RangoFechas) {
    const { desde, hasta } = this.rango(r);

    // 1) Tomamos a TODOS los usuarios que crearon al menos un local.
    //    Esto cubre vendedores, admins, marketing, etc. Sin requerir
    //    que su `rol` sea exactamente 'vendedor' (el slug podría variar
    //    o el usuario podría tener solo rolRef).
    const creadoresAgg = await this.usuarioModel.aggregate([
      { $match: { rol: 'admin-local', usuarioCreacion: { $ne: null } } },
      {
        $group: {
          _id: '$usuarioCreacion',
          localIds: { $push: '$_id' },
          activos: {
            $sum: {
              $cond: [{ $eq: ['$estado', true] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
    ]);

    if (!creadoresAgg.length) {
      return {
        rango: { desde: desde.toISOString(), hasta: hasta.toISOString() },
        vendedores: [],
      };
    }

    const creadoresIds = creadoresAgg.map((c: any) => c._id);
    const creadores = await this.usuarioModel
      .find(
        { _id: { $in: creadoresIds } },
        { nombre: 1, email: 1, estado: 1, rol: 1 },
      )
      .lean();
    const mapById = new Map(
      creadores.map((u: any) => [u._id.toString(), u]),
    );

    const result: any[] = [];
    for (const c of creadoresAgg) {
      const u: any = mapById.get(c._id.toString());
      // Si el creador fue borrado del sistema, lo conservamos para visibilidad.
      const canjes = c.localIds.length
        ? await this.historicoModel.countDocuments({
            usuario: { $in: c.localIds },
            fechaEscaneo: { $gte: desde, $lte: hasta },
          })
        : 0;

      result.push({
        vendedorId: c._id,
        nombre: u?.nombre || '(usuario eliminado)',
        email: u?.email || '',
        rol: u?.rol || '—',
        estado: u?.estado ?? false,
        localesCreados: c.total,
        activos: c.activos,
        inactivos: c.total - c.activos,
        canjesGenerados: canjes,
      });
    }

    result.sort((a, b) => {
      if (b.canjesGenerados !== a.canjesGenerados)
        return b.canjesGenerados - a.canjesGenerados;
      return b.localesCreados - a.localesCreados;
    });

    return {
      rango: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      vendedores: result,
    };
  }

  // ── Detalle de creador ──────────────────────────────────────────────
  async detalleCreador(creadorId: string, r: RangoFechas) {
    const { desde, hasta } = this.rango(r);
    if (!Types.ObjectId.isValid(creadorId)) {
      return { error: 'ID inválido' };
    }
    const _id = new Types.ObjectId(creadorId);

    const creador: any = await this.usuarioModel
      .findById(_id, { nombre: 1, email: 1, rol: 1, estado: 1, createdAt: 1 })
      .lean();
    if (!creador) return { error: 'Creador no encontrado' };

    // Locales creados por este usuario (admin-local).
    // usuarioCreacion puede estar guardado como ObjectId o como String
    // (data histórica mixta), por eso matcheamos ambos casos con $or.
    const localesRaw: any[] = await this.usuarioModel.aggregate([
      {
        $match: {
          rol: 'admin-local',
          $or: [
            { usuarioCreacion: _id },
            { usuarioCreacion: creadorId },
          ],
        },
      },
      {
        $lookup: {
          from: 'ciudades',
          localField: 'ciudades',
          foreignField: '_id',
          as: 'ciudadesPop',
        },
      },
      {
        $lookup: {
          from: 'categorias',
          localField: 'categorias',
          foreignField: '_id',
          as: 'categoriasPop',
        },
      },
      {
        $project: {
          _id: 1,
          nombre: 1,
          email: 1,
          estado: 1,
          createdAt: 1,
          promedioCalificacion: 1,
          ciudad: { $arrayElemAt: ['$ciudadesPop.nombre', 0] },
          categoria: { $arrayElemAt: ['$categoriasPop.nombre', 0] },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    const localIds = localesRaw.map((l: any) => l._id);
    let totalCanjes = 0;
    let totalFlash = 0;
    let canjesPorLocal = new Map<string, number>();

    if (localIds.length) {
      // Canjes por local en el rango
      const aggCanjes = await this.historicoModel.aggregate([
        {
          $match: {
            usuario: { $in: localIds },
            fechaEscaneo: { $gte: desde, $lte: hasta },
          },
        },
        { $group: { _id: '$usuario', total: { $sum: 1 } } },
      ]);
      for (const a of aggCanjes) {
        canjesPorLocal.set(a._id.toString(), a.total);
        totalCanjes += a.total;
      }

      // Flash creadas
      totalFlash = await this.flashModel.countDocuments({
        usuario: { $in: localIds },
        createdAt: { $gte: desde, $lte: hasta },
      });
    }

    const locales = localesRaw.map((l: any) => ({
      localId: l._id,
      nombre: l.nombre,
      email: l.email,
      ciudad: l.ciudad || '—',
      categoria: l.categoria || '—',
      estado: l.estado,
      calificacion: l.promedioCalificacion || 0,
      canjes: canjesPorLocal.get(l._id.toString()) || 0,
      creadoEn: l.createdAt,
    }));

    locales.sort((a, b) => b.canjes - a.canjes);

    // Serie diaria de canjes (tendencia)
    let serie: Array<{ fecha: string; canjes: number }> = [];
    if (localIds.length) {
      const aggSerie = await this.historicoModel.aggregate([
        {
          $match: {
            usuario: { $in: localIds },
            fechaEscaneo: { $gte: desde, $lte: hasta },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$fechaEscaneo' },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      serie = aggSerie.map((s) => ({ fecha: s._id, canjes: s.total }));
    }

    const activos = locales.filter((l) => l.estado).length;

    return {
      rango: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      creador: {
        _id: creador._id,
        nombre: creador.nombre,
        email: creador.email,
        rol: creador.rol || '—',
        estado: creador.estado,
        miembroDesde: creador.createdAt,
      },
      kpis: {
        totalLocales: locales.length,
        activos,
        inactivos: locales.length - activos,
        totalCanjes,
        totalFlash,
      },
      locales,
      serie,
    };
  }

  // ── 3) CLIENTES + RETENCIÓN ────────────────────────────────────────
  async resumenClientes(r: RangoFechas) {
    const { desde, hasta } = this.rango(r);

    const totalClientes = await this.clienteModel.countDocuments();
    const nuevosEnRango = await this.clienteModel.countDocuments({
      createdAt: { $gte: desde, $lte: hasta },
    });

    // Top clientes por canjes
    const topClientes = await this.historicoModel.aggregate([
      {
        $lookup: {
          from: 'cupons',
          localField: 'cupon',
          foreignField: '_id',
          as: 'cupon',
        },
      },
      { $unwind: '$cupon' },
      { $match: { fechaEscaneo: { $gte: desde, $lte: hasta } } },
      { $group: { _id: '$cupon.cliente', canjes: { $sum: 1 } } },
      { $sort: { canjes: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: 'clientes',
          localField: '_id',
          foreignField: '_id',
          as: 'cliente',
        },
      },
      { $unwind: { path: '$cliente', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          clienteId: '$_id',
          nombres: '$cliente.nombres',
          apellidos: '$cliente.apellidos',
          email: '$cliente.email',
          canjes: 1,
        },
      },
    ]);

    // Clientes con compra aprobada (recurrentes vs únicos)
    const conPagos = await this.pagoModel.aggregate([
      {
        $match: {
          createdAt: { $gte: desde, $lte: hasta },
          status: 'APROBADO',
        },
      },
      { $group: { _id: '$cliente', total: { $sum: 1 } } },
    ]);
    const recurrentes = conPagos.filter((c) => c.total > 1).length;
    const unicos = conPagos.filter((c) => c.total === 1).length;

    // Distribución geográfica (clientes por provincia)
    const porProvincia = await this.clienteModel.aggregate([
      {
        $lookup: {
          from: 'ciudades',
          localField: 'ciudad',
          foreignField: '_id',
          as: 'ciudad',
        },
      },
      { $unwind: { path: '$ciudad', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'provincias',
          localField: 'ciudad.provincia',
          foreignField: '_id',
          as: 'provincia',
        },
      },
      { $unwind: { path: '$provincia', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$provincia.nombre', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    return {
      rango: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      totalClientes,
      nuevosEnRango,
      recurrentes,
      unicos,
      topClientes,
      porProvincia: porProvincia.map((p) => ({
        provincia: p._id || 'Sin provincia',
        total: p.total,
      })),
    };
  }

  // ── 4) FLASH ───────────────────────────────────────────────────────
  async rendimientoFlash(r: RangoFechas) {
    const { desde, hasta } = this.rango(r);

    const agg = await this.flashModel.aggregate([
      { $match: { createdAt: { $gte: desde, $lte: hasta } } },
      {
        $group: {
          _id: '$estado',
          total: { $sum: 1 },
          vistas: { $sum: '$vistas' },
          canjes: { $sum: '$canjes' },
        },
      },
    ]);

    const total = agg.reduce((a, x) => a + x.total, 0);
    const vistas = agg.reduce((a, x) => a + (x.vistas || 0), 0);
    const canjes = agg.reduce((a, x) => a + (x.canjes || 0), 0);

    // Top flash
    const topFlash = await this.flashModel.aggregate([
      { $match: { createdAt: { $gte: desde, $lte: hasta } } },
      { $sort: { canjes: -1 } },
      { $limit: 15 },
      {
        $lookup: {
          from: 'usuarios',
          localField: 'usuario',
          foreignField: '_id',
          as: 'local',
        },
      },
      { $unwind: '$local' },
      {
        $project: {
          _id: 0,
          flashId: '$_id',
          titulo: 1,
          tipo: 1,
          estado: 1,
          canjes: 1,
          vistas: 1,
          canjeable: 1,
          local: '$local.nombre',
        },
      },
    ]);

    return {
      rango: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      totalFlash: total,
      vistas,
      canjes,
      tasaConversion: vistas > 0 ? canjes / vistas : 0,
      porEstado: agg.map((a) => ({
        estado: a._id,
        total: a.total,
        canjes: a.canjes,
        vistas: a.vistas,
      })),
      topFlash,
    };
  }

  // ── 5) SOLICITUDES ─────────────────────────────────────────────────
  async embudoSolicitudes(r: RangoFechas) {
    const { desde, hasta } = this.rango(r);

    const porEstado = await this.solicitudModel.aggregate([
      { $match: { createdAt: { $gte: desde, $lte: hasta } } },
      { $group: { _id: '$estado', total: { $sum: 1 } } },
    ]);

    const total = porEstado.reduce((a, x) => a + x.total, 0);

    const serieDiaria = await this.solicitudModel.aggregate([
      { $match: { createdAt: { $gte: desde, $lte: hasta } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Tiempo promedio aprobación: estimado con updatedAt - createdAt
    // para las solicitudes que ya no están PENDIENTE (APROBADO/RECHAZADO).
    const tiempos = await this.solicitudModel.aggregate([
      {
        $match: {
          createdAt: { $gte: desde, $lte: hasta },
          estado: { $ne: 'PENDIENTE' },
        },
      },
      {
        $project: {
          horas: {
            $divide: [
              { $subtract: ['$updatedAt', '$createdAt'] },
              1000 * 60 * 60,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          promedio: { $avg: '$horas' },
        },
      },
    ]);

    return {
      rango: { desde: desde.toISOString(), hasta: hasta.toISOString() },
      total,
      porEstado: porEstado.map((p) => ({ estado: p._id, total: p.total })),
      serie: serieDiaria.map((s) => ({ fecha: s._id, total: s.total })),
      tiempoPromedioHoras: tiempos[0]?.promedio || 0,
    };
  }
}
