// src/comentarios/comentarios.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Usuario, UsuarioDocument } from 'src/usuarios/schema/usuario.schema';
import { Comentario, ComentarioDocument } from './schema/comentario.schema';

@Injectable()
export class ComentarioService {
  constructor(
    @InjectModel(Comentario.name)
    private readonly comentarioModel: Model<ComentarioDocument>,
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
  ) {}

  // comentarios.service.ts

async crearComentario(data: {
  usuarioId: string; // negocio/local
  clienteId: string; // autor (Cliente)
  texto: string;
  calificacion: number; // 1..5
}) {
  if (!Types.ObjectId.isValid(data.usuarioId) || !Types.ObjectId.isValid(data.clienteId)) {
    throw new BadRequestException('IDs inválidos');
  }
  if (typeof data.calificacion !== 'number' || data.calificacion < 1 || data.calificacion > 5) {
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
              totalComentarios: { $add: [ { $ifNull: ['$totalComentarios', 0] }, 1 ] },
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
                      { $add: [ { $ifNull: ['$totalComentarios', 0] }, 1 ] },
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
  const pageSize   = Math.max(1, Math.min(100, Number(limit) || 10));
  const skip       = (pageNumber - 1) * pageSize;

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
        ((usuario.promedioCalificacion ?? 0) * totalActual - calif) / nuevoTotal;

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
  if (body.calificacion != null && (body.calificacion < 1 || body.calificacion > 5)) {
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
  if (typeof body.calificacion === 'number' && body.calificacion !== califAnterior) {
    const usuario = await this.usuarioModel.findById(comentario.usuario);
    if (usuario) {
      const total = usuario.totalComentarios ?? 0; // el total NO cambia en un update
      if (total > 0) {
        const promedioAnterior = usuario.promedioCalificacion ?? 0;
        // nuevoPromedio = (prom * total - califAnterior + califNueva) / total
        const nuevoPromedio =
          ((promedioAnterior * total) - califAnterior + body.calificacion) / total;

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


}
