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
}
