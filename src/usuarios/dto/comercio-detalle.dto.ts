// src/comercios/dto/comercio-mini.dto.ts
export interface PromoPrincipalDto {
  id?: string;
  title?: string;
  placeName?: string;
  description?: string;
  imageUrl?: string;
  logoUrl?: string;
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

export interface ComercioMiniResponse {
  promoPrincipal?: PromoPrincipalDto;
  ciudades: string[];
  categorias: string[];
  promedioCalificacion: number;
  totalComentarios: number;
  telefono?: string;
  comentarios: ComentarioDto[]; // puede ir vacío
}
