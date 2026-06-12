import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cupon, CuponDocument } from 'src/cupon/schemas/cupon.schema';
import { EstadoCupon } from 'src/cupon/enum/estados_cupon';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';

/// Tareas programadas. Hoy: recordatorio de cuponeras por vencer (cliente).
@Injectable()
export class TareasCronService {
  private readonly logger = new Logger(TareasCronService.name);

  constructor(
    @InjectModel(Cupon.name) private readonly cuponModel: Model<CuponDocument>,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /// Cada día a las 8:00 (hora del servidor): notifica al cliente las
  /// cuponeras activas que vencen dentro de los próximos 3 días.
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
}
