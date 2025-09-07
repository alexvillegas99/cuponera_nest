// src/comentarios/comentarios.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Usuario, UsuarioDocument } from 'src/usuarios/schema/usuario.schema';
import { Comentario, ComentarioDocument } from './schema/comentario.schema';
import {
  HistoricoCupon,
  HistoricoCuponDocument,
} from 'src/historico-cupon/schemas/historico-cupon.schema';
import { Cupon, CuponDocument } from 'src/cupon/schemas/cupon.schema';
import { VersionCuponera, VersionCuponeraDocument } from 'src/version-cuponera/schemas/version-cuponera.schema';



// Tipos finos para lean()
type CupIdThin = { _id: Types.ObjectId };                          // version

@Injectable()
export class ComentarioService {
  constructor(
    @InjectModel(Comentario.name)
    private readonly comentarioModel: Model<ComentarioDocument>,
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(HistoricoCupon.name)
    private readonly historicoModel: Model<HistoricoCuponDocument>,
    @InjectModel(Cupon.name) private readonly cuponModel: Model<CuponDocument>,
    @InjectModel(VersionCuponera.name)
  private readonly versionModel: Model<VersionCuponeraDocument>,

  ) {}
  private readonly logger = new Logger(ComentarioService.name);
  // comentarios.service.ts

  async crearComentario(data: {
    usuarioId: string; // negocio/local
    clienteId: string; // autor (Cliente)
    texto: string;
    calificacion: number; // 1..5
  }) {
    if (
      !Types.ObjectId.isValid(data.usuarioId) ||
      !Types.ObjectId.isValid(data.clienteId)
    ) {
      throw new BadRequestException('IDs inválidos');
    }
    if (
      typeof data.calificacion !== 'number' ||
      data.calificacion < 1 ||
      data.calificacion > 5
    ) {
      throw new BadRequestException('calificacion debe estar entre 1 y 5');
    }

    const usuarioOid = new Types.ObjectId(data.usuarioId);
    const clienteOid = new Types.ObjectId(data.clienteId);

    const session = await this.comentarioModel.db.startSession();
    let creado: any;

    try {
      await session.withTransaction(async () => {
        // 1) Crear comentario
        const [doc] = await this.comentarioModel.create(
          [
            {
              usuario: usuarioOid,
              autor: clienteOid,
              texto: (data.texto || '').trim(),
              calificacion: data.calificacion,
            },
          ],
          { session },
        );

        // 2) Actualizar promedio y total (ATÓMICO con pipeline)
        await this.usuarioModel.findByIdAndUpdate(
          usuarioOid,
          [
            {
              $set: {
                totalComentarios: {
                  $add: [{ $ifNull: ['$totalComentarios', 0] }, 1],
                },
                promedioCalificacion: {
                  $round: [
                    {
                      $divide: [
                        {
                          $add: [
                            {
                              $multiply: [
                                { $ifNull: ['$promedioCalificacion', 0] },
                                { $ifNull: ['$totalComentarios', 0] },
                              ],
                            },
                            data.calificacion,
                          ],
                        },
                        { $add: [{ $ifNull: ['$totalComentarios', 0] }, 1] },
                      ],
                    },
                    2,
                  ],
                },
              },
            },
          ],
          { new: true, session },
        );

        // 3) Devolver el comentario (opcional: populate del autor Cliente)
        creado = await this.comentarioModel
          .findById(doc._id)
          .populate('autor', 'nombres apellidos email')
          .lean()
          .session(session);
      });
    } finally {
      session.endSession();
    }

    return creado;
  }

  async listarPorUsuario(usuarioId: string, page = 1, limit = 10) {
    const oid = new Types.ObjectId(usuarioId);
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [items, total] = await Promise.all([
      this.comentarioModel
        .find({ usuario: oid })
        .populate('autor', 'nombres apellidos email') // ← ahora Cliente
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.comentarioModel.countDocuments({ usuario: oid }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listarComentariosPorUsuario(usuarioId: string, page = 1, limit = 10) {
    // 1) Validaciones y cast
    if (!Types.ObjectId.isValid(usuarioId)) {
      throw new BadRequestException('usuarioId inválido');
    }
    const objectId = new Types.ObjectId(usuarioId);

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 10));
    const skip = (pageNumber - 1) * pageSize;

    // (opcional) logs de verificación
    // console.log({ objectId, pageNumber, pageSize, skip });

    // 2) Query en paralelo
    const [items, total] = await Promise.all([
      this.comentarioModel
        .find({ usuario: objectId })
        .populate('autor', 'nombres apellidos email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      this.comentarioModel.countDocuments({ usuario: objectId }),
    ]);

    return {
      items,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async eliminarComentario(comentarioId: string) {
    if (!isValidObjectId(comentarioId)) {
      throw new BadRequestException('comentarioId inválido');
    }

    const comentario = await this.comentarioModel.findById(comentarioId).lean();
    if (!comentario) throw new NotFoundException('Comentario no encontrado');

    await this.comentarioModel.findByIdAndDelete(comentarioId).exec();

    const usuario = await this.usuarioModel.findById(comentario.usuario);
    if (usuario) {
      const totalActual = usuario.totalComentarios ?? 0;
      const calif = comentario.calificacion ?? 0;

      if (totalActual <= 1) {
        usuario.totalComentarios = 0;
        usuario.promedioCalificacion = 0;
      } else {
        const nuevoTotal = totalActual - 1;
        const nuevoPromedio =
          ((usuario.promedioCalificacion ?? 0) * totalActual - calif) /
          nuevoTotal;

        usuario.totalComentarios = nuevoTotal;
        usuario.promedioCalificacion = Number(nuevoPromedio.toFixed(2));
      }
      await usuario.save();
    }

    return { ok: true };
  }

  // + añade este método
  async actualizarComentarioPorId(
    comentarioId: string,
    body: { texto?: string; calificacion?: number },
  ) {
    if (!isValidObjectId(comentarioId)) {
      throw new BadRequestException('comentarioId inválido');
    }
    if (
      body.calificacion != null &&
      (body.calificacion < 1 || body.calificacion > 5)
    ) {
      throw new BadRequestException('calificacion debe estar entre 1 y 5');
    }

    const comentario = await this.comentarioModel.findById(comentarioId);
    if (!comentario) throw new NotFoundException('Comentario no encontrado');

    // Guardamos calificación previa para ajustar promedio si cambia
    const califAnterior = comentario.calificacion;

    if (typeof body.texto === 'string') {
      comentario.texto = body.texto.trim();
    }
    if (typeof body.calificacion === 'number') {
      comentario.calificacion = body.calificacion;
    }
    await comentario.save();

    // Reajustar promedio SOLO si cambió la calificación
    if (
      typeof body.calificacion === 'number' &&
      body.calificacion !== califAnterior
    ) {
      const usuario = await this.usuarioModel.findById(comentario.usuario);
      if (usuario) {
        const total = usuario.totalComentarios ?? 0; // el total NO cambia en un update
        if (total > 0) {
          const promedioAnterior = usuario.promedioCalificacion ?? 0;
          // nuevoPromedio = (prom * total - califAnterior + califNueva) / total
          const nuevoPromedio =
            (promedioAnterior * total - califAnterior + body.calificacion) /
            total;

          usuario.promedioCalificacion = Number(nuevoPromedio.toFixed(2));
          await usuario.save();
        }
      }
    }

    // devolver populate
    return this.comentarioModel
      .findById(comentario._id)
      .populate('autor', 'nombres apellidos email')
      .lean()
      .exec();
  }

  private async recalcUsuarioRating(usuarioOid: Types.ObjectId) {
    const [row] = await this.comentarioModel.aggregate([
      { $match: { usuario: usuarioOid } },
      {
        $group: {
          _id: null,
          avg: { $avg: '$calificacion' },
          total: { $sum: 1 },
        },
      },
    ]);
    await this.usuarioModel.findByIdAndUpdate(
      usuarioOid,
      {
        promedioCalificacion: Number(((row?.avg ?? 0) as number).toFixed(2)),
        totalComentarios: row?.total ?? 0,
      },
      { new: false },
    );
  }

  /**
   * Retorna si el cliente puede comentar en el usuario/local:
   * - Debe existir >= 1 histórico del cliente cuyo cupón tenga usuarioActivador = usuarioId
   * - Además retorna si ya tiene un comentario y el comentario mismo (si existe)
   */
  async elegibilidad(usuarioId: string, clienteId: string) {
  const C = 'elegibilidad(agg)';
  const t0 = Date.now();
  this.logger.log(`[${C}] ▶️ start usuarioId=${usuarioId} clienteId=${clienteId}`);

  if (!isValidObjectId(usuarioId) || !isValidObjectId(clienteId)) {
    this.logger.warn(`[${C}] ❌ IDs inválidos`);
    throw new BadRequestException('IDs inválidos');
  }

  const uId  = new Types.ObjectId(usuarioId);
  const cId  = new Types.ObjectId(clienteId);
  const uHex = uId.toHexString();

  // nombres reales de las colecciones (por si no son "cupons"/"historicocupons")
  const HIST_COL = this.historicoModel.collection.name;

  const t1a = Date.now();
  // 1) pipeline: cupones del cliente → lookup a historico con usuario=local
  const hit = await this.cuponModel.aggregate([
    { $match: { cliente: cId } },
    { $project: { _id: 1, idStr: { $toString: '$_id' } } },
    {
      $lookup: {
        from: HIST_COL,
        let: { idObj: '$_id', idStr: '$idStr', uHex: uHex },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  // cupon en histórico = este cupón (soporta string u OID)
                  {
                    $or: [
                      { $eq: ['$cupon', '$$idStr'] },       // historico.cupon == _id as string
                      { $eq: ['$cupon', '$$idObj'] },       // historico.cupon == _id as ObjectId
                      { $eq: [
                          { $convert: { input: '$cupon', to: 'objectId', onError: null, onNull: null } },
                          '$$idObj'
                        ]},
                    ],
                  },
                  // usuario en histórico = este local (soporta string u OID)
                  {
                    $or: [
                      { $eq: ['$usuario', '$$uHex'] },            // historico.usuario string
                      { $eq: [ { $toString: '$usuario' }, '$$uHex' ] }, // historico.usuario OID
                    ],
                  },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
          { $limit: 1 },
        ],
        as: 'hist',
      },
    },
    { $match: { hist: { $ne: [] } } },
    { $limit: 1 },
    { $project: { _id: 1 } },
  ]).exec();
  const t1b = Date.now();

  const elegible = hit.length > 0;
  this.logger.debug(`[${C}] agg result len=${hit.length} elegible=${elegible} dur=${t1b - t1a}ms`);

  // 2) (extra) tu comentario actual
  const t2a = Date.now();
  const my = await this.comentarioModel
    .findOne({ usuario: uId, autor: cId })
    .populate('autor', 'nombres apellidos email')
    .lean()
    .exec();
  const t2b = Date.now();
  this.logger.debug(
    `[${C}] myComment exists=${!!my} ${my ? `id=${my._id} calif=${my.calificacion}` : ''} dur=${t2b - t2a}ms`,
  );

  const result = { elegible, tieneComentario: !!my, comentario: my ?? null };
  const tF = Date.now();
  this.logger.log(
    `[${C}] ✅ end elegible=${result.elegible} tieneComentario=${result.tieneComentario} total=${tF - t0}ms`,
  );
  return result;
}

  async obtenerMiComentario(usuarioId: string, clienteId: string) {
    if (!isValidObjectId(usuarioId) || !isValidObjectId(clienteId)) {
      throw new BadRequestException('IDs inválidos');
    }
    const uId = new Types.ObjectId(usuarioId);
    const cId = new Types.ObjectId(clienteId);

    const doc = await this.comentarioModel
      .findOne({ usuario: uId, autor: cId })
      .populate('autor', 'nombres apellidos email')
      .lean();

    return doc; // puede ser null
  }

  async upsertMiComentario(
    usuarioId: string,
    clienteId: string,
    body: { texto?: string; calificacion?: number },
  ) {
    if (!isValidObjectId(usuarioId) || !isValidObjectId(clienteId)) {
      throw new BadRequestException('IDs inválidos');
    }
    const { calificacion, texto = '' } = body ?? {};
    if (
      typeof calificacion !== 'number' ||
      calificacion < 1 ||
      calificacion > 5
    ) {
      throw new BadRequestException('calificacion debe estar entre 1 y 5');
    }

    const uId = new Types.ObjectId(usuarioId);
    const cId = new Types.ObjectId(clienteId);

    const existing = await this.comentarioModel.findOne({
      usuario: uId,
      autor: cId,
    });

    if (!existing) {
      // Validar permiso antes de crear
      const elegible = await this.puedeComentarPorHistorico(
        usuarioId,
        clienteId,
      );
      if (!elegible) {
        throw new BadRequestException(
          'Aún no has utilizado una promoción en este local.',
        );
      }

      const created = await this.comentarioModel.create({
        usuario: uId,
        autor: cId,
        texto: texto.trim(),
        calificacion,
      });

      // Recalcula KPIs del local (si tienes ese flujo incremental/aggregate)
      await this.recalcUsuarioRating(uId); // si ya lo tienes, úsalo; si no, omite esta línea

      return this.comentarioModel
        .findById(created._id)
        .populate('autor', 'nombres apellidos email')
        .lean();
    }

    // Editar existente
    const califAnterior = existing.calificacion;
    existing.texto = texto.trim();
    existing.calificacion = calificacion;
    await existing.save();

    if (califAnterior !== calificacion) {
      await this.recalcUsuarioRating(uId); // o tu fórmula incremental si la prefieres
    }

    return this.comentarioModel
      .findById(existing._id)
      .populate('autor', 'nombres apellidos email')
      .lean();
  }
  async eliminarMiComentario(usuarioId: string, clienteId: string) {
    if (!isValidObjectId(usuarioId) || !isValidObjectId(clienteId)) {
      throw new BadRequestException('IDs inválidos');
    }
    const uId = new Types.ObjectId(usuarioId);
    const cId = new Types.ObjectId(clienteId);

    const del = await this.comentarioModel.findOneAndDelete({
      usuario: uId,
      autor: cId,
    });
    if (!del)
      throw new NotFoundException('No tienes comentario en este local.');

    await this.recalcUsuarioRating(uId); // o tu versión incremental
    return { ok: true };
  }
async puedeComentarPorHistorico(
  usuarioId: string,
  clienteId: string,
): Promise<boolean> {
  const C = 'puedeComentarPorHistorico(agg)';
  this.logger.log(`[${C}] ▶️ usuarioId=${usuarioId} clienteId=${clienteId}`);

  if (!isValidObjectId(usuarioId) || !isValidObjectId(clienteId)) {
    this.logger.warn(`[${C}] ❌ IDs inválidos`);
    throw new BadRequestException('IDs inválidos');
  }
  const uId  = new Types.ObjectId(usuarioId);
  const cId  = new Types.ObjectId(clienteId);
  const uHex = uId.toHexString();

  // Usa el nombre real de la colección de cupones (evita hardcodear 'cupons'/'cupones')
  const CUPON_COL = this.cuponModel.collection.name;

  const pipeline: any[] = [
    // Históricos del local/usuario: soporta string u ObjectId
    { $match: { $or: [ { usuario: uId }, { usuario: uHex } ] } },

    {
      $lookup: {
        from: CUPON_COL,
        let: {
          cupObj: '$cupon',
          cupStr: { $toString: '$cupon' }, // si historico.cupon es OID, generamos también su string
          cliId:  cId,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  // El cupón debe pertenecer al cliente actual
                  { $eq: ['$cliente', '$$cliId'] },

                  // Match de cupón tolerante a tipo:
                  // - historico.cupon (string) == toString(_id)
                  // - historico.cupon (ObjectId) == _id
                  {
                    $or: [
                      { $eq: ['$_id', '$$cupObj'] },
                      { $eq: [ { $toString: '$_id' }, '$$cupStr' ] },
                    ],
                  },
                ],
              },
            },
          },
          { $project: { _id: 1 } },
          { $limit: 1 },
        ],
        as: 'cup',
      },
    },

    // Si hubo match en cupones, existe al menos un uso válido
    { $match: { cup: { $ne: [] } } },
    { $limit: 1 },
    { $project: { _id: 1 } },
  ];

  // Log del pipeline (ObjectId -> hex)
  const dump = (v: any) =>
    JSON.stringify(v, (k, val) => (val instanceof Types.ObjectId ? val.toHexString() : val), 2);
  this.logger.debug(`[${C}] pipeline=\n${dump(pipeline)}`);

  try {
    const hit = await this.historicoModel.aggregate(pipeline).exec();
    this.logger.debug(`[${C}] res len=${hit.length} elegible=${hit.length > 0}`);
    return hit.length > 0;
  } catch (e: any) {
    this.logger.error(`[${C}] aggregate error: ${e?.message}`, e?.stack);
    throw e;
  }
}

}
