export interface LugarScanResumen {
  usuarioId: string;
  nombre: string;
  email: string;
  ciudades: string[]; // ids
  count: number;      // veces escaneado este cupón
  lastScan: string | null; // ISO
}

export interface DetalleCuponResponse {
  cupon: {
    _id: string;
    version: string;
    secuencial: number;
    estado: string;
    numeroDeEscaneos: number;
    fechaActivacion: string | null;
    fechaVencimiento: string | null;
    ultimoScaneo: string | null;
    cliente?: string | null;
  };
  version: {
    _id: string;
    nombre: string;
    estado: boolean;
    ciudadesDisponibles: string[]; // ids
    numeroDeLocales: number;
    descripcion?: string;
  };

  // Universo de candidatos = admin-local en ciudades de la versión
  candidatosTotal: number;

  // Resumen por “local” (usuario admin-local)
  lugaresScaneados: LugarScanResumen[];
  lugaresSinScannear: {
    usuarioId: string;
    nombre: string;
    email: string;
    ciudades: string[]; // ids
  }[];

  // Totales
  totalLugaresScaneados: number;     // distintos “locales” que escanearon
  totalEscaneos: number;             // suma de count
}
