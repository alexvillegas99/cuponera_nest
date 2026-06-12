// src/comercios/dto/comercio-mini.dto.ts
export interface MediaItemDto {
  url?: string;
  type?: 'image' | 'video';
  thumbnailUrl?: string;
}

/** Item del catálogo (producto/servicio): foto + nombre + descripción */
export interface ProductoItemDto {
  url?: string;
  /** base64 entrante; el backend lo sube a S3 y lo reemplaza por url */
  base64?: string;
  nombre?: string;
  descripcion?: string;
}

export interface PromoPrincipalDto {
  id?: string;
  title?: string;
  placeName?: string;
  description?: string;
  imageUrl?: string;
  logoUrl?: string;
  /** Galería del local (hasta 5 fotos/videos); videos solo se reproducen en el detalle */
  galeria?: MediaItemDto[];
  /** Catálogo del local (productos/servicios), sin límite de cantidad */
  productos?: ProductoItemDto[];
  isTwoForOne?: boolean;
  tags?: string[];
  rating?: number;
  scheduleLabel?: string;
  distanceLabel?: string;
  startDate?: string | null;
  endDate?: string | null;
  isFlash?: boolean;
  address?: string;
  aplicaTodosLosDias?: boolean;
  fechasExcluidas?: string[];
}

export interface ComentarioDto {
  autorNombre?: string;
  texto?: string;
  rating?: number;
  fecha?: string; // ISO
}

export interface PromoFlashMiniDto {
  _id: string;
  titulo: string;
  descripcion: string;
  imagenUrl: string;
  tipo: string;
  etiqueta?: string | null;
  vence: Date | string;
  canjeable: boolean;
}

export interface ComercioMiniResponse {
  promoPrincipal?: PromoPrincipalDto;
  promocionesFlash?: PromoFlashMiniDto[];
  tieneFlash?: boolean;
  ciudades: string[];
  categorias: string[];
  promedioCalificacion: number;
  totalComentarios: number;
  telefono?: string;
  ubicacion?: { lat: number; lng: number } | null;
  comentarios: ComentarioDto[]; // puede ir vacío
}
