import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cupon, CuponDocument } from 'src/cupon/schemas/cupon.schema';
import { EstadoCupon } from 'src/cupon/enum/estados_cupon';
import {
  HistoricoCupon,
  HistoricoCuponDocument,
} from 'src/historico-cupon/schemas/historico-cupon.schema';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';

/**
 * Tareas programadas para el cliente. Cada cron es defensivo: errores en un
 * elemento NO detienen el procesamiento del resto. Best-effort por diseño —
 * si una push falla la siguiente sigue corriendo.
 */
@Injectable()
export class TareasCronService {
  private readonly logger = new Logger(TareasCronService.name);

  constructor(
    @InjectModel(Cupon.name) private readonly cuponModel: Model<CuponDocument>,
    @InjectModel(HistoricoCupon.name)
    private readonly historicoModel: Model<HistoricoCuponDocument>,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /**
   * Cada día a las 8:00: notifica al cliente las cuponeras activas que vencen
   * dentro de los próximos 3 días.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async notificarCuponesPorVencer() {
    const ahora = new Date();
    const limite = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000);
    try {
      const cupones = await this.cuponModel
        .find({
          estado: EstadoCupon.ACTIVO,
          cliente: { $ne: null },
          fechaVencimiento: { $gte: ahora, $lte: limite },
        })
        .populate('cliente', 'fcmToken')
        .populate('version', 'nombre')
        .lean();

      this.logger.log(`Cuponeras por vencer (≤3 días): ${cupones.length}`);

      for (const c of cupones as any[]) {
        const token = c.cliente?.fcmToken;
        if (!token) continue;
        const nombre = c.version?.nombre ?? 'Tu membresía';
        const dias = Math.max(
          1,
          Math.ceil(
            (new Date(c.fechaVencimiento).getTime() - ahora.getTime()) /
              86400000,
          ),
        );
        await this.notificaciones.enviarAToken(
          token,
          '⏰ Tu membresía vence pronto',
          `"${nombre}" vence en ${dias} día${dias === 1 ? '' : 's'}. ¡Aprovéchala!`,
        );
      }
    } catch (e: any) {
      this.logger.error(`Error cron cuponeras por vencer: ${e?.message}`);
    }
  }

  /**
   * Cada hora: a los clientes que canjearon hace 3–6h se les pide reseña.
   * El intervalo deja tiempo a que vivan la experiencia sin enviar el push
   * en el momento del canje (ya hay otro push entonces). Marca
   * `reseniaPedidaAt` para no preguntar dos veces el mismo canje.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async pedirResenasPendientes() {
    const ahora = new Date();
    const desde = new Date(ahora.getTime() - 6 * 60 * 60 * 1000);
    const hasta = new Date(ahora.getTime() - 3 * 60 * 60 * 1000);
    try {
      const historicos = await this.historicoModel
        .find({
          fechaEscaneo: { $gte: desde, $lte: hasta },
          reseniaPedidaAt: null,
        })
        .populate({
          path: 'cupon',
          select: 'cliente',
          populate: { path: 'cliente', select: 'fcmToken nombres' },
        })
        .populate('usuario', 'nombre')
        .lean();

      this.logger.log(`Reseñas a pedir esta hora: ${historicos.length}`);

      for (const h of historicos as any[]) {
        const cupon = h.cupon;
        const cliente = cupon?.cliente;
        const token = cliente?.fcmToken;
        const localNombre = h.usuario?.nombre ?? 'el local';
        if (!token) {
          // Igual marcamos como pedida — sin token no tiene sentido reintentar.
          await this.historicoModel.updateOne(
            { _id: h._id },
            { $set: { reseniaPedidaAt: ahora } },
          );
          continue;
        }
        try {
          await this.notificaciones.enviarAToken(
            token,
            `🌟 ¿Cómo te fue en ${localNombre}?`,
            `Tu opinión ayuda a otros. Calificá tu visita en menos de 1 minuto.`,
            { tipo: 'resena', localId: String(h.usuario?._id ?? '') },
          );
        } catch (e: any) {
          this.logger.warn(`Push reseña falló para ${h._id}: ${e?.message}`);
        }
        // Marcar incluso si falló para no spamear en el siguiente run.
        await this.historicoModel.updateOne(
          { _id: h._id },
          { $set: { reseniaPedidaAt: ahora } },
        );
      }
    } catch (e: any) {
      this.logger.error(`Error cron reseñas pendientes: ${e?.message}`);
    }
  }

  /**
   * Cada día a las 10:00: a los clientes que tienen una cuponera activa
   * sin canjear hace ≥7 días les recuerda que está esperando. Reglas:
   * - Cupón ACTIVO, asignado, no expirado.
   * - `ultimoScaneo` null O ≥7 días atrás.
   * - `fechaActivacion` ≥7 días atrás (no avisamos en la 1ª semana).
   * - `recordatorioSinUsoAt` null O ≥14 días atrás (no spamear).
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async recordarCuponesSinUso() {
    const ahora = new Date();
    const hace7d = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hace14d = new Date(ahora.getTime() - 14 * 24 * 60 * 60 * 1000);
    try {
      const cupones = await this.cuponModel
        .find({
          estado: EstadoCupon.ACTIVO,
          cliente: { $ne: null },
          fechaActivacion: { $lte: hace7d },
          fechaVencimiento: { $gt: ahora },
          $and: [
            {
              $or: [{ ultimoScaneo: null }, { ultimoScaneo: { $lte: hace7d } }],
            },
            {
              $or: [
                { recordatorioSinUsoAt: null },
                { recordatorioSinUsoAt: { $lte: hace14d } },
              ],
            },
          ],
        })
        .populate('cliente', 'fcmToken nombres')
        .populate('version', 'nombre')
        .lean();

      this.logger.log(`Cupones sin uso a recordar: ${cupones.length}`);

      for (const c of cupones as any[]) {
        const token = c.cliente?.fcmToken;
        const nombreCuponera = c.version?.nombre ?? 'Tu cuponera';
        const nombreCliente = c.cliente?.nombres
          ? `${c.cliente.nombres}`.split(' ')[0]
          : null;
        const saludo = nombreCliente ? `${nombreCliente}, ` : '';
        if (token) {
          try {
            await this.notificaciones.enviarAToken(
              token,
              '🎟️ Tu cuponera te espera',
              `${saludo}"${nombreCuponera}" sigue sin estrenar. Hay beneficios listos para usar.`,
              { tipo: 'recordatorio-cupon', cuponId: String(c._id) },
            );
          } catch (e: any) {
            this.logger.warn(
              `Push recordatorio falló para cupon ${c._id}: ${e?.message}`,
            );
          }
        }
        await this.cuponModel.updateOne(
          { _id: c._id },
          { $set: { recordatorioSinUsoAt: ahora } },
        );
      }
    } catch (e: any) {
      this.logger.error(`Error cron cupones sin uso: ${e?.message}`);
    }
  }
}
