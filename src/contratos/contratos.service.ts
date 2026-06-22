import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import PDFDocument = require('pdfkit');
import { Usuario, UsuarioDocument } from 'src/usuarios/schema/usuario.schema';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';
import {
  DatosContratoV1,
  renderContratoV1,
} from './templates/contrato-v1';

export interface ContratoEstado {
  aceptado: boolean;
  contratoUrl: string | null;
  cedulaUrl: string | null;
  contratoVersion: string | null;
  contratoAceptadoEn: string | null;
  datosFaltantes: string[];
  /** Datos actuales del local — para pre-rellenar el form en cliente. */
  datosLocal: {
    nombreLocal: string;
    ruc: string | null;
    direccion: string | null;
    representanteLegal: string | null;
    cedulaRepresentante: string | null;
    estadoCivilRepresentante: string | null;
    celular: string | null;
  };
}

@Injectable()
export class ContratosService {
  private readonly logger = new Logger(ContratosService.name);
  private readonly VERSION_ACTUAL = 'v1';

  constructor(
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    private readonly s3: AmazonS3Service,
  ) {}

  /**
   * Estado del contrato para el admin-local autenticado. Devuelve qué datos
   * faltan para que el cliente pueda pintar el form previo.
   */
  async miEstado(usuarioId: string): Promise<ContratoEstado> {
    const u = await this.usuarioModel.findById(usuarioId).lean();
    if (!u) throw new NotFoundException('Usuario no encontrado');

    const faltantes: string[] = [];
    if (!(u as any).ruc) faltantes.push('ruc');
    if (!(u as any).direccion) faltantes.push('direccion');
    if (!(u as any).representanteLegal) faltantes.push('representanteLegal');
    if (!(u as any).cedulaRepresentante) faltantes.push('cedulaRepresentante');
    if (!(u as any).celular && !(u as any).telefono) faltantes.push('celular');

    return {
      aceptado: !!(u as any).contratoAceptado,
      contratoUrl: (u as any).contratoUrl ?? null,
      cedulaUrl: (u as any).cedulaUrl ?? null,
      contratoVersion: (u as any).contratoVersion ?? null,
      contratoAceptadoEn:
        (u as any).contratoAceptadoEn?.toISOString?.() ?? null,
      datosFaltantes: faltantes,
      datosLocal: {
        nombreLocal: (u as any).nombre ?? '',
        ruc: (u as any).ruc ?? null,
        direccion: (u as any).direccion ?? null,
        representanteLegal: (u as any).representanteLegal ?? null,
        cedulaRepresentante: (u as any).cedulaRepresentante ?? null,
        estadoCivilRepresentante:
          (u as any).estadoCivilRepresentante ?? null,
        celular: (u as any).celular ?? (u as any).telefono ?? null,
      },
    };
  }

  /**
   * Acepta el contrato: persiste datos del local, genera el PDF con los
   * datos rellenados + la cédula al final, sube a S3 y marca aceptado.
   */
  async aceptar(
    usuarioId: string,
    dto: {
      cedulaBase64: string;
      datosLocal: {
        ruc?: string;
        direccion?: string;
        representanteLegal?: string;
        cedulaRepresentante?: string;
        estadoCivilRepresentante?: string;
        celular?: string;
      };
      aceptaTerminos: boolean;
    },
  ): Promise<{ contratoUrl: string; cedulaUrl: string }> {
    if (!dto?.aceptaTerminos) {
      throw new BadRequestException('Tenés que aceptar los términos.');
    }
    if (!dto?.cedulaBase64) {
      throw new BadRequestException('Falta la foto de la cédula.');
    }

    const usuario = await this.usuarioModel.findById(usuarioId);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // 1) Actualizar datos del local con los del form (si no estaban).
    const updates: any = {};
    const set = (k: string, v?: string) => {
      if (v && String(v).trim() !== '') updates[k] = String(v).trim();
    };
    set('ruc', dto.datosLocal?.ruc);
    set('direccion', dto.datosLocal?.direccion);
    set('representanteLegal', dto.datosLocal?.representanteLegal);
    set('cedulaRepresentante', dto.datosLocal?.cedulaRepresentante);
    set('estadoCivilRepresentante', dto.datosLocal?.estadoCivilRepresentante);
    set('celular', dto.datosLocal?.celular);
    if (Object.keys(updates).length) {
      Object.assign(usuario, updates);
      await usuario.save();
    }

    // 2) Subir cédula a S3.
    const cedula = await this.s3.uploadBase64({
      image: dto.cedulaBase64,
      route: `contratos/${usuarioId}`,
    });

    // 3) Bajar la cédula como Buffer para embeber en el PDF (S3 público).
    let cedulaBuffer: Buffer | null = null;
    try {
      const dataUrl = dto.cedulaBase64;
      const comma = dataUrl.indexOf(',');
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      cedulaBuffer = Buffer.from(b64, 'base64');
    } catch (_) {
      cedulaBuffer = null;
    }

    // 4) Generar el PDF del contrato firmado.
    const pdfBuffer = await this._generarPdf(usuario, cedulaBuffer);

    // 5) Subir el PDF a S3.
    const contrato = await this.s3.uploadBuffer({
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      route: `contratos/${usuarioId}`,
      fileName: `contrato-${this.VERSION_ACTUAL}.pdf`,
    });

    // 6) Marcar aceptado.
    usuario.set('contratoAceptado', true);
    usuario.set('contratoAceptadoEn', new Date());
    usuario.set('contratoUrl', contrato.url);
    usuario.set('cedulaUrl', cedula.url);
    usuario.set('contratoVersion', this.VERSION_ACTUAL);
    await usuario.save();

    return { contratoUrl: contrato.url, cedulaUrl: cedula.url };
  }

  /**
   * Migración: marca como contratoAceptado=true a todos los admin-local
   * creados antes de [fechaCorte]. Se invoca una vez al boot. Idempotente.
   */
  async bootstrapMarcarExistentes(fechaCorte: Date): Promise<number> {
    try {
      const res = await this.usuarioModel.updateMany(
        {
          rol: 'admin-local',
          createdAt: { $lt: fechaCorte },
          contratoAceptado: { $ne: true },
        },
        {
          $set: {
            contratoAceptado: true,
            contratoAceptadoEn: fechaCorte,
            contratoVersion: 'legacy',
          },
        },
      );
      this.logger.log(
        `Bootstrap contratos: ${res.modifiedCount} admin-local legacy marcados como aceptado`,
      );
      return res.modifiedCount ?? 0;
    } catch (e: any) {
      this.logger.error(`bootstrapMarcarExistentes: ${e?.message}`);
      return 0;
    }
  }

  /** Render del PDF con pdfkit. */
  private async _generarPdf(
    usuario: UsuarioDocument,
    cedulaBuffer: Buffer | null,
  ): Promise<Buffer> {
    const datos: DatosContratoV1 = {
      nombreLocal: (usuario as any).nombre ?? '',
      representanteLegal: (usuario as any).representanteLegal ?? '',
      cedulaRepresentante: (usuario as any).cedulaRepresentante ?? '',
      estadoCivilRepresentante:
        (usuario as any).estadoCivilRepresentante ?? '',
      rucLocal: (usuario as any).ruc ?? '',
      direccionLocal: (usuario as any).direccion ?? '',
      celularLocal:
        (usuario as any).celular ?? (usuario as any).telefono ?? '',
      fechaLiteral: this._fechaLiteral(new Date()),
    };
    const render = renderContratoV1(datos);

    return await new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new (PDFDocument as any)({
          size: 'A4',
          margins: { top: 60, bottom: 60, left: 60, right: 60 },
          info: {
            Title: `Contrato Club Enjoy — ${datos.nombreLocal}`,
            Author: 'Club Enjoy',
          },
        });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Encabezado
        doc
          .fillColor('#1A1206')
          .font('Helvetica-Bold')
          .fontSize(16)
          .text(render.titulo, { align: 'center' });
        doc.moveDown(0.5);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#666')
          .text('Plataforma Club Enjoy — Ambato, Ecuador', { align: 'center' });
        doc.moveDown(1);

        // Cuerpo
        for (const b of render.bloques) {
          if (b.tipo === 'titulo') {
            doc
              .moveDown(0.4)
              .font('Helvetica-Bold')
              .fontSize(11)
              .fillColor('#1A1206')
              .text(b.texto);
            doc.moveDown(0.2);
          } else if (b.tipo === 'parrafo') {
            doc
              .font('Helvetica')
              .fontSize(10)
              .fillColor('#222')
              .text(b.texto, { align: 'justify', lineGap: 2 });
            doc.moveDown(0.3);
          } else if (b.tipo === 'lista') {
            for (const it of b.items) {
              doc
                .font('Helvetica')
                .fontSize(10)
                .fillColor('#222')
                .text(it, { align: 'justify', indent: 10, lineGap: 2 });
              doc.moveDown(0.15);
            }
            doc.moveDown(0.2);
          }
        }

        // Firmas
        doc.moveDown(1.5);
        const y = doc.y;
        const colW = (doc.page.width - 120) / 2 - 10;
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#666')
          .text('___________________________', 60, y, { width: colW, align: 'center' })
          .text('CLUB ENJOY', 60, y + 12, { width: colW, align: 'center' });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#666')
          .text('___________________________', 60 + colW + 20, y, {
            width: colW,
            align: 'center',
          })
          .text(
            (usuario as any).representanteLegal || datos.nombreLocal,
            60 + colW + 20,
            y + 12,
            { width: colW, align: 'center' },
          );

        // Cédula adjunta
        if (cedulaBuffer) {
          try {
            doc.addPage();
            doc
              .font('Helvetica-Bold')
              .fontSize(12)
              .fillColor('#1A1206')
              .text('Anexo: Cédula de ciudadanía del representante', { align: 'center' });
            doc.moveDown(0.5);
            doc.image(cedulaBuffer, {
              fit: [doc.page.width - 120, doc.page.height - 200],
              align: 'center',
              valign: 'center',
            });
          } catch (e: any) {
            this.logger.warn(`No se pudo embeber la cédula en el PDF: ${e?.message}`);
          }
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private _fechaLiteral(d: Date): string {
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    return `a los ${d.getDate()} días del mes de ${meses[d.getMonth()]} del año ${d.getFullYear()}`;
  }
}
