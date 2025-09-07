// amazon-s3.service.ts
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { UploadBase64ImageDto } from './dto/upload-base64-image.dto';
import { v4 as uuidv4 } from 'uuid';
import { S3_CLIENT } from './providers/s3.provider';

@Injectable()
export class AmazonS3Service {
  private readonly logger = new Logger(AmazonS3Service.name);
  private readonly bucketName: string;
  private readonly region: string;
  private readonly publicRead: boolean;
  private readonly prefix: string | undefined;
  private readonly maxBytes: number;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    private readonly config: ConfigService,
  ) {
    this.bucketName = this.config.get<string>('AWS_S3_BUCKET_NAME')!;
    this.region = this.config.get<string>('AWS_S3_BUCKET_REGION')!;
    this.publicRead = this.config.get<string>('AWS_S3_PUBLIC_READ') === 'true';
    this.prefix = this.config.get<string>('AWS_S3_KEY_PREFIX') || undefined;
    this.maxBytes = Number(this.config.get<string>('AWS_S3_MAX_BYTES') ?? 5_000_000); // 5MB por defecto

    if (!this.bucketName || !this.region) {
      throw new Error('Faltan AWS_S3_BUCKET_NAME / AWS_S3_BUCKET_REGION');
    }
  }

  // -------- utils

  private normalizeFolder(input?: string) {
    if (!input) return '';
    return input.replace(/\s+/g, '').replace(/^\/+|\/+$/g, '');
  }

private todayParts() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  return { yyyy };
}

  private parseDataUrlOrBase64(image: string) {
    // Devuelve { contentType, base64 } o lanza error
    const m = /^data:(.+);base64,(.*)$/i.exec(image);
    if (m) {
      return { contentType: m[1].toLowerCase(), base64: m[2] };
    }
    // base64 “puro”: tratamos de detectar tipo por cabecera (heurística simple)
    // Nota: para mayor precisión puedes usar "file-type" (npm) en el backend.
    const head = image.slice(0, 16);
    let contentType = 'image/jpeg';
    if (head.startsWith('iVBORw0KGgo')) contentType = 'image/png';
    else if (head.startsWith('/9j/')) contentType = 'image/jpeg';
    else if (head.startsWith('UklGR')) contentType = 'image/webp';
    return { contentType, base64: image };
  }

  private extByContentType(ct: string) {
    if (ct.includes('png')) return 'png';
    if (ct.includes('webp')) return 'webp';
    if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
    if (ct.includes('gif')) return 'gif';
    return 'bin';
  }

  private buildKey(folder: string | undefined, name: string) {
  const { yyyy } = this.todayParts();
  const chunks = [folder, yyyy].filter(Boolean);
  return [...chunks, name].join('/').replace(/\/{2,}/g, '/');
}
  private virtualHostedUrl(key: string) {
    // Para us-east-2 este formato es correcto
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURI(key)}`;
  }

  // -------- API

 async uploadBase64(body: UploadBase64ImageDto) {
  if (!body?.image) throw new BadRequestException('No se recibió la imagen.');

  const { contentType, base64 } = this.parseDataUrlOrBase64(body.image);
  const buffer = Buffer.from(base64, 'base64');

  const ext = this.extByContentType(contentType);
  const fileName = `${uuidv4()}.${ext}`;
  const folder = this.normalizeFolder(body.route);
  const key = this.buildKey(folder, fileName);

const put = new PutObjectCommand({
  Bucket: this.bucketName,
  Key: key,
  Body: buffer,
  ContentType: contentType,
  CacheControl: 'public, max-age=31536000, immutable',
  // NO ACL aquí
});
await this.s3.send(put);
const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURI(key)}`;
return { url, key };
}


  async deleteImageByUrl(imageUrlOrKey: string, versionId?: string): Promise<boolean> {
    try {
      let key = imageUrlOrKey;

      if (/^https?:\/\//i.test(imageUrlOrKey)) {
        const url = new URL(imageUrlOrKey);
        // Host virtual (usual): https://bucket.s3.region.amazonaws.com/path
        key = decodeURI(url.pathname.replace(/^\/+/, ''));
      }

      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          VersionId: versionId,
        }),
      );
      this.logger.log(`Imagen eliminada: ${key}${versionId ? ` (v=${versionId})` : ''}`);
      return true;
    } catch (err: any) {
      const code = err?.name || err?.Code;
      const msg = err?.message || 'Error al eliminar en S3.';
      this.logger.error(`S3 DeleteObject failed [${code}]: ${msg}`);
      return false;
    }
  }

  /** Verifica si existe y devuelve metadatos (útil en validaciones) */
  async head(key: string) {
    const r = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: key }));
    return {
      contentType: r.ContentType,
      contentLength: r.ContentLength,
      etag: r.ETag,
      lastModified: r.LastModified,
      metadata: r.Metadata,
    };
  }

  
}
