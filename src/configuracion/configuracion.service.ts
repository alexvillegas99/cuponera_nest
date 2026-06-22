import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Configuracion } from './schema/configuracion.schema';

@Injectable()
export class ConfiguracionService {
  constructor(
    @InjectModel(Configuracion.name)
    private readonly model: Model<Configuracion>,
  ) {
    this.seedDefaults();
  }

  private async seedDefaults() {
    const defaults = [
      {
        clave: 'whatsapp_numero',
        valor: '+593999999999',
        descripcion: 'Número de WhatsApp para adquisición de cuponeras',
      },
      {
        clave: 'whatsapp_mensaje',
        valor: 'Hola, quiero adquirir una cuponera.',
        descripcion: 'Mensaje predeterminado al escribir por WhatsApp',
      },
      {
        clave: 'cuponeras_disponibles',
        valor: JSON.stringify([
          { nombre: 'Cuponera Básica', precio: '15.00' },
          { nombre: 'Cuponera Premium', precio: '25.00' },
        ]),
        descripcion: 'Lista de cuponeras disponibles con precios (JSON)',
      },
      {
        clave: 'cuentas_bancarias',
        valor: JSON.stringify([
          { banco: 'Banco Pichincha', tipo: 'Ahorros', numero: '2200000000', titular: 'Enjoy S.A.', ci: '1800000000' },
        ]),
        descripcion: 'Cuentas bancarias para transferencia (JSON)',
      },
      {
        clave: 'transferencia_instrucciones',
        valor: 'Realiza tu transferencia al monto indicado y sube una foto del comprobante para validar tu compra.',
        descripcion: 'Instrucciones que se muestran al usuario antes de subir comprobante',
      },
      {
        clave: 'solicitud_notif_emails',
        valor: 'avillegas7510@gmail.com',
        descripcion:
          'Lista de correos (separados por coma) que reciben aviso de cada nueva solicitud de cuponera',
      },
      {
        clave: 'promotor_descuento_default',
        valor: '20',
        descripcion:
          'Porcentaje de descuento que recibe el cliente al usar un código de promotor (default; cada promotor puede tener override).',
      },
      {
        clave: 'promotor_comision_default',
        valor: '20',
        descripcion:
          'Porcentaje de comisión que gana el promotor por cada venta hecha con su código (default; cada promotor puede tener override).',
      },
    ];

    for (const d of defaults) {
      const exists = await this.model.findOne({ clave: d.clave });
      if (!exists) {
        await this.model.create(d);
      }
    }
  }

  async findAll(): Promise<Configuracion[]> {
    return this.model.find().sort({ clave: 1 }).exec();
  }

  async findByClave(clave: string): Promise<Configuracion> {
    const doc = await this.model.findOne({ clave });
    if (!doc) throw new NotFoundException(`Configuración "${clave}" no encontrada`);
    return doc;
  }

  async upsert(
    clave: string,
    data: { valor: string; descripcion?: string },
  ): Promise<Configuracion> {
    return this.model.findOneAndUpdate(
      { clave },
      { $set: { valor: data.valor, ...(data.descripcion && { descripcion: data.descripcion }) } },
      { new: true, upsert: true },
    );
  }

  async remove(clave: string): Promise<void> {
    const result = await this.model.deleteOne({ clave });
    if (result.deletedCount === 0)
      throw new NotFoundException(`Configuración "${clave}" no encontrada`);
  }

  /**
   * Helper: lee una clave numérica con default. No tira si no existe — útil
   * para configuraciones opcionales tipo "% descuento default".
   */
  async getNumberOrDefault(clave: string, defaultValue: number): Promise<number> {
    try {
      const doc = await this.model.findOne({ clave }).lean();
      if (!doc) return defaultValue;
      const n = Number((doc as any).valor);
      return Number.isFinite(n) ? n : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /** Idempotente: setea la clave solo si no existe. Útil para seeds. */
  async setIfMissing(clave: string, valor: string, descripcion?: string) {
    const existe = await this.model.exists({ clave });
    if (!existe) await this.upsert(clave, { valor, descripcion });
  }
}
