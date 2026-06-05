/** Las 24 provincias del Ecuador con su código DPA (INEC). */
export interface ProvinciaSeed {
  nombre: string;
  codigo: string;
}

export const PROVINCIAS_SEED: ProvinciaSeed[] = [
  { nombre: 'Azuay', codigo: '01' },
  { nombre: 'Bolívar', codigo: '02' },
  { nombre: 'Cañar', codigo: '03' },
  { nombre: 'Carchi', codigo: '04' },
  { nombre: 'Cotopaxi', codigo: '05' },
  { nombre: 'Chimborazo', codigo: '06' },
  { nombre: 'El Oro', codigo: '07' },
  { nombre: 'Esmeraldas', codigo: '08' },
  { nombre: 'Guayas', codigo: '09' },
  { nombre: 'Imbabura', codigo: '10' },
  { nombre: 'Loja', codigo: '11' },
  { nombre: 'Los Ríos', codigo: '12' },
  { nombre: 'Manabí', codigo: '13' },
  { nombre: 'Morona Santiago', codigo: '14' },
  { nombre: 'Napo', codigo: '15' },
  { nombre: 'Pastaza', codigo: '16' },
  { nombre: 'Pichincha', codigo: '17' },
  { nombre: 'Tungurahua', codigo: '18' },
  { nombre: 'Zamora Chinchipe', codigo: '19' },
  { nombre: 'Galápagos', codigo: '20' },
  { nombre: 'Sucumbíos', codigo: '21' },
  { nombre: 'Orellana', codigo: '22' },
  { nombre: 'Santo Domingo de los Tsáchilas', codigo: '23' },
  { nombre: 'Santa Elena', codigo: '24' },
];
