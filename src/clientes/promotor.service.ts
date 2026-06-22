import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Cliente, ClienteDocument } from './schema/cliente.schema';
import { ConfiguracionService } from 'src/configuracion/configuracion.service';

export interface DescuentoCalculado {
  promotorId: string;
  promotorNombre: string;
  porcentajeDescuento: number;
  porcentajeComision: number;
  montoOriginal: number;
  montoDescuento: number;
  montoComision: number;
  montoFinal: number;
}

/**
 * Lógica del programa de promotores. Se inyecta en:
 *  - `PagosService` y `SolicitudCuponeraService`: para aplicar descuento al
 *    crear un pago/solicitud, y para acreditar la comisión cuando se aprueba.
 *  - `ClientesController`: para que el admin convierta/desactive promotores
 *    y para que el cliente promotor vea sus stats.
 *
 * Convenciones:
 *  - Códigos siempre en MAYÚSCULAS (el schema usa uppercase: true).
 *  - Montos en USD con decimales (no centavos) — coincide con `Pago.monto`
 *    que también es decimal en BD.
 *  - Idempotencia en acreditación: usa la flag `comisionAcreditada` del pago.
 */
@Injectable()
export class PromotorService {
  private readonly logger = new Logger(PromotorService.name);

  constructor(
    @InjectModel(Cliente.name)
    private readonly clienteModel: Model<ClienteDocument>,
    private readonly configuracionService: ConfiguracionService,
  ) {}

  /** % defaults globales (claves en `configuraciones`). Si no existen, 20/20. */
  async getDefaults(): Promise<{ descuento: number; comision: number }> {
    const [descuento, comision] = await Promise.all([
      this.configuracionService.getNumberOrDefault(
        'promotor_descuento_default',
        20,
      ),
      this.configuracionService.getNumberOrDefault(
        'promotor_comision_default',
        20,
      ),
    ]);
    return { descuento, comision };
  }

  /** Normaliza el código a uppercase + trim. */
  private _normalizarCodigo(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const c = String(raw).trim().toUpperCase();
    return c.length === 0 ? null : c;
  }

  /**
   * Valida un código. Lanza si: vacío, no existe, promotor desactivado,
   * o el propio comprador es el promotor (no se puede autocodificar).
   */
  async validarCodigo(
    codigoRaw: string,
    clienteCompradorId?: string,
  ): Promise<{
    promotorId: string;
    promotorNombre: string;
    porcentajeDescuento: number;
    porcentajeComision: number;
  }> {
    const codigo = this._normalizarCodigo(codigoRaw);
    if (!codigo) throw new BadRequestException('Código vacío');

    const promotor = await this.clienteModel
      .findOne({
        codigoDescuento: codigo,
        isPromotor: true,
        deleted: { $ne: true },
        estado: { $ne: false },
      })
      .lean();

    if (!promotor) {
      throw new NotFoundException(
        'Código no válido. Verificá que esté bien escrito.',
      );
    }

    if (
      clienteCompradorId &&
      String((promotor as any)._id) === String(clienteCompradorId)
    ) {
      throw new ForbiddenException(
        'No puedes usar tu propio código de promotor.',
      );
    }

    const defaults = await this.getDefaults();
    return {
      promotorId: String((promotor as any)._id),
      promotorNombre: `${(promotor as any).nombres ?? ''} ${(promotor as any).apellidos ?? ''}`.trim() ||
        ((promotor as any).email ?? 'Promotor'),
      porcentajeDescuento:
        (promotor as any).porcentajeDescuento ?? defaults.descuento,
      porcentajeComision:
        (promotor as any).porcentajeComision ?? defaults.comision,
    };
  }

  /**
   * Calcula el descuento/comisión para un monto dado. No persiste nada;
   * solo devuelve el snapshot. El call site (pagos/solicitudes) lo guarda
   * en su propio schema.
   */
  async calcularDescuento(
    codigoRaw: string,
    montoOriginal: number,
    clienteCompradorId?: string,
  ): Promise<DescuentoCalculado> {
    const promo = await this.validarCodigo(codigoRaw, clienteCompradorId);
    const montoDescuento = +(
      (montoOriginal * promo.porcentajeDescuento) /
      100
    ).toFixed(2);
    const montoComision = +(
      (montoOriginal * promo.porcentajeComision) /
      100
    ).toFixed(2);
    const montoFinal = +(montoOriginal - montoDescuento).toFixed(2);
    return {
      ...promo,
      montoOriginal: +montoOriginal.toFixed(2),
      montoDescuento,
      montoComision,
      montoFinal,
    };
  }

  /**
   * Acredita la comisión al saldo del promotor. Es idempotente: si el doc ya
   * tiene `comisionAcreditada=true` no hace nada. Se debe llamar cuando la
   * solicitud/pago llega a APROBADO.
   */
  async acreditarComision(args: {
    docId: Types.ObjectId | string;
    promotorId?: Types.ObjectId | string | null;
    montoComision?: number;
    comisionAcreditada?: boolean;
    // Función para marcar la flag en el doc original (pago o solicitud).
    marcarAcreditada: () => Promise<void>;
  }): Promise<void> {
    const {
      promotorId,
      montoComision,
      comisionAcreditada,
      marcarAcreditada,
    } = args;
    if (!promotorId || comisionAcreditada || !montoComision || montoComision <= 0) {
      return;
    }
    try {
      await this.clienteModel.findByIdAndUpdate(promotorId, {
        $inc: { saldoPromotor: montoComision },
      });
      await marcarAcreditada();
    } catch (e: any) {
      this.logger.error(`acreditarComision falló: ${e?.message}`);
    }
  }

  /** Convierte a un cliente en promotor con los overrides opcionales. */
  async convertirEnPromotor(
    clienteId: string,
    dto: {
      codigoDescuento: string;
      porcentajeDescuento?: number | null;
      porcentajeComision?: number | null;
    },
  ) {
    if (!isValidObjectId(clienteId))
      throw new BadRequestException('ID cliente inválido');
    const codigo = this._normalizarCodigo(dto.codigoDescuento);
    if (!codigo)
      throw new BadRequestException('El código no puede estar vacío');
    if (codigo.length < 3 || codigo.length > 20) {
      throw new BadRequestException(
        'El código debe tener entre 3 y 20 caracteres',
      );
    }
    if (!/^[A-Z0-9_-]+$/i.test(codigo)) {
      throw new BadRequestException(
        'El código solo puede tener letras, números, guiones y guion bajo',
      );
    }

    // Verificar que el código no esté usado por otro cliente.
    const ocupado = await this.clienteModel.exists({
      codigoDescuento: codigo,
      _id: { $ne: new Types.ObjectId(clienteId) },
    });
    if (ocupado) {
      throw new BadRequestException(
        'Ese código ya está en uso por otro promotor',
      );
    }

    const updated = await this.clienteModel
      .findByIdAndUpdate(
        clienteId,
        {
          $set: {
            isPromotor: true,
            codigoDescuento: codigo,
            porcentajeDescuento: dto.porcentajeDescuento ?? null,
            porcentajeComision: dto.porcentajeComision ?? null,
          },
        },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException('Cliente no encontrado');
    return updated;
  }

  /** Desactiva al promotor (mantiene saldo, libera el código). */
  async desactivarPromotor(clienteId: string) {
    if (!isValidObjectId(clienteId))
      throw new BadRequestException('ID cliente inválido');
    const updated = await this.clienteModel
      .findByIdAndUpdate(
        clienteId,
        { $set: { isPromotor: false, codigoDescuento: null } },
        { new: true },
      )
      .lean();
    if (!updated) throw new NotFoundException('Cliente no encontrado');
    return updated;
  }

  /** Stats que ve el propio promotor desde su perfil en la app. */
  async statsPropias(clienteId: string) {
    if (!isValidObjectId(clienteId))
      throw new BadRequestException('ID cliente inválido');
    const cliente = await this.clienteModel
      .findById(clienteId)
      .select(
        'isPromotor codigoDescuento porcentajeDescuento porcentajeComision saldoPromotor',
      )
      .lean();
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    if (!(cliente as any).isPromotor) {
      return { isPromotor: false };
    }
    const defaults = await this.getDefaults();
    return {
      isPromotor: true,
      codigoDescuento: (cliente as any).codigoDescuento,
      porcentajeDescuento:
        (cliente as any).porcentajeDescuento ?? defaults.descuento,
      porcentajeComision:
        (cliente as any).porcentajeComision ?? defaults.comision,
      saldoPromotor: (cliente as any).saldoPromotor ?? 0,
    };
  }
}
