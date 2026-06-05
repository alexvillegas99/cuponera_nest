/**
 * Cantones del Ecuador (cabeceras cantonales = ciudades), agrupados por código
 * de provincia (ver PROVINCIAS_SEED). ~221 cantones.
 * Nota: los nombres repetidos entre provincias se desambiguan con la provincia
 * entre paréntesis para respetar el índice único por nombre (ej. "Bolívar (Carchi)").
 */
export interface CantonSeed {
  nombre: string;
  provinciaCodigo: string;
}

export const CANTONES_SEED: CantonSeed[] = [
  // 01 Azuay (15)
  { nombre: 'Cuenca', provinciaCodigo: '01' },
  { nombre: 'Girón', provinciaCodigo: '01' },
  { nombre: 'Gualaceo', provinciaCodigo: '01' },
  { nombre: 'Nabón', provinciaCodigo: '01' },
  { nombre: 'Paute', provinciaCodigo: '01' },
  { nombre: 'Pucará', provinciaCodigo: '01' },
  { nombre: 'San Fernando', provinciaCodigo: '01' },
  { nombre: 'Santa Isabel', provinciaCodigo: '01' },
  { nombre: 'Sígsig', provinciaCodigo: '01' },
  { nombre: 'Oña', provinciaCodigo: '01' },
  { nombre: 'Chordeleg', provinciaCodigo: '01' },
  { nombre: 'El Pan', provinciaCodigo: '01' },
  { nombre: 'Sevilla de Oro', provinciaCodigo: '01' },
  { nombre: 'Guachapala', provinciaCodigo: '01' },
  { nombre: 'Camilo Ponce Enríquez', provinciaCodigo: '01' },

  // 02 Bolívar (7)
  { nombre: 'Guaranda', provinciaCodigo: '02' },
  { nombre: 'Chillanes', provinciaCodigo: '02' },
  { nombre: 'Chimbo', provinciaCodigo: '02' },
  { nombre: 'Echeandía', provinciaCodigo: '02' },
  { nombre: 'San Miguel', provinciaCodigo: '02' },
  { nombre: 'Caluma', provinciaCodigo: '02' },
  { nombre: 'Las Naves', provinciaCodigo: '02' },

  // 03 Cañar (7)
  { nombre: 'Azogues', provinciaCodigo: '03' },
  { nombre: 'Biblián', provinciaCodigo: '03' },
  { nombre: 'Cañar', provinciaCodigo: '03' },
  { nombre: 'La Troncal', provinciaCodigo: '03' },
  { nombre: 'El Tambo', provinciaCodigo: '03' },
  { nombre: 'Déleg', provinciaCodigo: '03' },
  { nombre: 'Suscal', provinciaCodigo: '03' },

  // 04 Carchi (6)
  { nombre: 'Tulcán', provinciaCodigo: '04' },
  { nombre: 'Bolívar (Carchi)', provinciaCodigo: '04' },
  { nombre: 'Espejo', provinciaCodigo: '04' },
  { nombre: 'Mira', provinciaCodigo: '04' },
  { nombre: 'Montúfar', provinciaCodigo: '04' },
  { nombre: 'San Pedro de Huaca', provinciaCodigo: '04' },

  // 05 Cotopaxi (7)
  { nombre: 'Latacunga', provinciaCodigo: '05' },
  { nombre: 'La Maná', provinciaCodigo: '05' },
  { nombre: 'Pangua', provinciaCodigo: '05' },
  { nombre: 'Pujilí', provinciaCodigo: '05' },
  { nombre: 'Salcedo', provinciaCodigo: '05' },
  { nombre: 'Saquisilí', provinciaCodigo: '05' },
  { nombre: 'Sigchos', provinciaCodigo: '05' },

  // 06 Chimborazo (10)
  { nombre: 'Riobamba', provinciaCodigo: '06' },
  { nombre: 'Alausí', provinciaCodigo: '06' },
  { nombre: 'Colta', provinciaCodigo: '06' },
  { nombre: 'Chambo', provinciaCodigo: '06' },
  { nombre: 'Chunchi', provinciaCodigo: '06' },
  { nombre: 'Guamote', provinciaCodigo: '06' },
  { nombre: 'Guano', provinciaCodigo: '06' },
  { nombre: 'Pallatanga', provinciaCodigo: '06' },
  { nombre: 'Penipe', provinciaCodigo: '06' },
  { nombre: 'Cumandá', provinciaCodigo: '06' },

  // 07 El Oro (14)
  { nombre: 'Machala', provinciaCodigo: '07' },
  { nombre: 'Arenillas', provinciaCodigo: '07' },
  { nombre: 'Atahualpa', provinciaCodigo: '07' },
  { nombre: 'Balsas', provinciaCodigo: '07' },
  { nombre: 'Chilla', provinciaCodigo: '07' },
  { nombre: 'El Guabo', provinciaCodigo: '07' },
  { nombre: 'Huaquillas', provinciaCodigo: '07' },
  { nombre: 'Marcabelí', provinciaCodigo: '07' },
  { nombre: 'Pasaje', provinciaCodigo: '07' },
  { nombre: 'Piñas', provinciaCodigo: '07' },
  { nombre: 'Portovelo', provinciaCodigo: '07' },
  { nombre: 'Santa Rosa', provinciaCodigo: '07' },
  { nombre: 'Zaruma', provinciaCodigo: '07' },
  { nombre: 'Las Lajas', provinciaCodigo: '07' },

  // 08 Esmeraldas (7)
  { nombre: 'Esmeraldas', provinciaCodigo: '08' },
  { nombre: 'Eloy Alfaro', provinciaCodigo: '08' },
  { nombre: 'Muisne', provinciaCodigo: '08' },
  { nombre: 'Quinindé', provinciaCodigo: '08' },
  { nombre: 'San Lorenzo', provinciaCodigo: '08' },
  { nombre: 'Atacames', provinciaCodigo: '08' },
  { nombre: 'Rioverde', provinciaCodigo: '08' },

  // 09 Guayas (25)
  { nombre: 'Guayaquil', provinciaCodigo: '09' },
  { nombre: 'Alfredo Baquerizo Moreno (Jujan)', provinciaCodigo: '09' },
  { nombre: 'Balao', provinciaCodigo: '09' },
  { nombre: 'Balzar', provinciaCodigo: '09' },
  { nombre: 'Colimes', provinciaCodigo: '09' },
  { nombre: 'Daule', provinciaCodigo: '09' },
  { nombre: 'Durán', provinciaCodigo: '09' },
  { nombre: 'El Empalme', provinciaCodigo: '09' },
  { nombre: 'El Triunfo', provinciaCodigo: '09' },
  { nombre: 'Milagro', provinciaCodigo: '09' },
  { nombre: 'Naranjal', provinciaCodigo: '09' },
  { nombre: 'Naranjito', provinciaCodigo: '09' },
  { nombre: 'Palestina', provinciaCodigo: '09' },
  { nombre: 'Pedro Carbo', provinciaCodigo: '09' },
  { nombre: 'Samborondón', provinciaCodigo: '09' },
  { nombre: 'Santa Lucía', provinciaCodigo: '09' },
  { nombre: 'Salitre', provinciaCodigo: '09' },
  { nombre: 'San Jacinto de Yaguachi', provinciaCodigo: '09' },
  { nombre: 'Playas', provinciaCodigo: '09' },
  { nombre: 'Simón Bolívar', provinciaCodigo: '09' },
  { nombre: 'Coronel Marcelino Maridueña', provinciaCodigo: '09' },
  { nombre: 'Lomas de Sargentillo', provinciaCodigo: '09' },
  { nombre: 'Nobol', provinciaCodigo: '09' },
  { nombre: 'General Antonio Elizalde (Bucay)', provinciaCodigo: '09' },
  { nombre: 'Isidro Ayora', provinciaCodigo: '09' },

  // 10 Imbabura (6)
  { nombre: 'Ibarra', provinciaCodigo: '10' },
  { nombre: 'Antonio Ante', provinciaCodigo: '10' },
  { nombre: 'Cotacachi', provinciaCodigo: '10' },
  { nombre: 'Otavalo', provinciaCodigo: '10' },
  { nombre: 'Pimampiro', provinciaCodigo: '10' },
  { nombre: 'San Miguel de Urcuquí', provinciaCodigo: '10' },

  // 11 Loja (16)
  { nombre: 'Loja', provinciaCodigo: '11' },
  { nombre: 'Calvas', provinciaCodigo: '11' },
  { nombre: 'Catamayo', provinciaCodigo: '11' },
  { nombre: 'Celica', provinciaCodigo: '11' },
  { nombre: 'Chaguarpamba', provinciaCodigo: '11' },
  { nombre: 'Espíndola', provinciaCodigo: '11' },
  { nombre: 'Gonzanamá', provinciaCodigo: '11' },
  { nombre: 'Macará', provinciaCodigo: '11' },
  { nombre: 'Paltas', provinciaCodigo: '11' },
  { nombre: 'Puyango', provinciaCodigo: '11' },
  { nombre: 'Saraguro', provinciaCodigo: '11' },
  { nombre: 'Sozoranga', provinciaCodigo: '11' },
  { nombre: 'Zapotillo', provinciaCodigo: '11' },
  { nombre: 'Pindal', provinciaCodigo: '11' },
  { nombre: 'Quilanga', provinciaCodigo: '11' },
  { nombre: 'Olmedo (Loja)', provinciaCodigo: '11' },

  // 12 Los Ríos (13)
  { nombre: 'Babahoyo', provinciaCodigo: '12' },
  { nombre: 'Baba', provinciaCodigo: '12' },
  { nombre: 'Montalvo', provinciaCodigo: '12' },
  { nombre: 'Puebloviejo', provinciaCodigo: '12' },
  { nombre: 'Quevedo', provinciaCodigo: '12' },
  { nombre: 'Urdaneta', provinciaCodigo: '12' },
  { nombre: 'Ventanas', provinciaCodigo: '12' },
  { nombre: 'Vínces', provinciaCodigo: '12' },
  { nombre: 'Palenque', provinciaCodigo: '12' },
  { nombre: 'Buena Fe', provinciaCodigo: '12' },
  { nombre: 'Valencia', provinciaCodigo: '12' },
  { nombre: 'Mocache', provinciaCodigo: '12' },
  { nombre: 'Quinsaloma', provinciaCodigo: '12' },

  // 13 Manabí (22)
  { nombre: 'Portoviejo', provinciaCodigo: '13' },
  { nombre: 'Bolívar (Manabí)', provinciaCodigo: '13' },
  { nombre: 'Chone', provinciaCodigo: '13' },
  { nombre: 'El Carmen', provinciaCodigo: '13' },
  { nombre: 'Flavio Alfaro', provinciaCodigo: '13' },
  { nombre: 'Jipijapa', provinciaCodigo: '13' },
  { nombre: 'Junín', provinciaCodigo: '13' },
  { nombre: 'Manta', provinciaCodigo: '13' },
  { nombre: 'Montecristi', provinciaCodigo: '13' },
  { nombre: 'Paján', provinciaCodigo: '13' },
  { nombre: 'Pichincha (Manabí)', provinciaCodigo: '13' },
  { nombre: 'Rocafuerte', provinciaCodigo: '13' },
  { nombre: 'Santa Ana', provinciaCodigo: '13' },
  { nombre: 'Sucre', provinciaCodigo: '13' },
  { nombre: 'Tosagua', provinciaCodigo: '13' },
  { nombre: '24 de Mayo', provinciaCodigo: '13' },
  { nombre: 'Pedernales', provinciaCodigo: '13' },
  { nombre: 'Olmedo (Manabí)', provinciaCodigo: '13' },
  { nombre: 'Puerto López', provinciaCodigo: '13' },
  { nombre: 'Jama', provinciaCodigo: '13' },
  { nombre: 'Jaramijó', provinciaCodigo: '13' },
  { nombre: 'San Vicente', provinciaCodigo: '13' },

  // 14 Morona Santiago (12)
  { nombre: 'Morona', provinciaCodigo: '14' },
  { nombre: 'Gualaquiza', provinciaCodigo: '14' },
  { nombre: 'Limón Indanza', provinciaCodigo: '14' },
  { nombre: 'Palora', provinciaCodigo: '14' },
  { nombre: 'Santiago', provinciaCodigo: '14' },
  { nombre: 'Sucúa', provinciaCodigo: '14' },
  { nombre: 'Huamboya', provinciaCodigo: '14' },
  { nombre: 'San Juan Bosco', provinciaCodigo: '14' },
  { nombre: 'Taisha', provinciaCodigo: '14' },
  { nombre: 'Logroño', provinciaCodigo: '14' },
  { nombre: 'Pablo Sexto', provinciaCodigo: '14' },
  { nombre: 'Tiwintza', provinciaCodigo: '14' },

  // 15 Napo (5)
  { nombre: 'Tena', provinciaCodigo: '15' },
  { nombre: 'Archidona', provinciaCodigo: '15' },
  { nombre: 'El Chaco', provinciaCodigo: '15' },
  { nombre: 'Quijos', provinciaCodigo: '15' },
  { nombre: 'Carlos Julio Arosemena Tola', provinciaCodigo: '15' },

  // 16 Pastaza (4)
  { nombre: 'Pastaza', provinciaCodigo: '16' },
  { nombre: 'Mera', provinciaCodigo: '16' },
  { nombre: 'Santa Clara', provinciaCodigo: '16' },
  { nombre: 'Arajuno', provinciaCodigo: '16' },

  // 17 Pichincha (8)
  { nombre: 'Quito', provinciaCodigo: '17' },
  { nombre: 'Cayambe', provinciaCodigo: '17' },
  { nombre: 'Mejía', provinciaCodigo: '17' },
  { nombre: 'Pedro Moncayo', provinciaCodigo: '17' },
  { nombre: 'Rumiñahui', provinciaCodigo: '17' },
  { nombre: 'San Miguel de los Bancos', provinciaCodigo: '17' },
  { nombre: 'Pedro Vicente Maldonado', provinciaCodigo: '17' },
  { nombre: 'Puerto Quito', provinciaCodigo: '17' },

  // 18 Tungurahua (9)
  { nombre: 'Ambato', provinciaCodigo: '18' },
  { nombre: 'Baños de Agua Santa', provinciaCodigo: '18' },
  { nombre: 'Cevallos', provinciaCodigo: '18' },
  { nombre: 'Mocha', provinciaCodigo: '18' },
  { nombre: 'Patate', provinciaCodigo: '18' },
  { nombre: 'Quero', provinciaCodigo: '18' },
  { nombre: 'San Pedro de Pelileo', provinciaCodigo: '18' },
  { nombre: 'Santiago de Píllaro', provinciaCodigo: '18' },
  { nombre: 'Tisaleo', provinciaCodigo: '18' },

  // 19 Zamora Chinchipe (9)
  { nombre: 'Zamora', provinciaCodigo: '19' },
  { nombre: 'Chinchipe', provinciaCodigo: '19' },
  { nombre: 'Nangaritza', provinciaCodigo: '19' },
  { nombre: 'Yacuambi', provinciaCodigo: '19' },
  { nombre: 'Yantzaza', provinciaCodigo: '19' },
  { nombre: 'El Pangui', provinciaCodigo: '19' },
  { nombre: 'Centinela del Cóndor', provinciaCodigo: '19' },
  { nombre: 'Palanda', provinciaCodigo: '19' },
  { nombre: 'Paquisha', provinciaCodigo: '19' },

  // 20 Galápagos (3)
  { nombre: 'San Cristóbal', provinciaCodigo: '20' },
  { nombre: 'Isabela', provinciaCodigo: '20' },
  { nombre: 'Santa Cruz', provinciaCodigo: '20' },

  // 21 Sucumbíos (7)
  { nombre: 'Lago Agrio', provinciaCodigo: '21' },
  { nombre: 'Gonzalo Pizarro', provinciaCodigo: '21' },
  { nombre: 'Putumayo', provinciaCodigo: '21' },
  { nombre: 'Shushufindi', provinciaCodigo: '21' },
  { nombre: 'Sucumbíos', provinciaCodigo: '21' },
  { nombre: 'Cascales', provinciaCodigo: '21' },
  { nombre: 'Cuyabeno', provinciaCodigo: '21' },

  // 22 Orellana (4)
  { nombre: 'Orellana', provinciaCodigo: '22' },
  { nombre: 'Aguarico', provinciaCodigo: '22' },
  { nombre: 'La Joya de los Sachas', provinciaCodigo: '22' },
  { nombre: 'Loreto', provinciaCodigo: '22' },

  // 23 Santo Domingo de los Tsáchilas (2)
  { nombre: 'Santo Domingo', provinciaCodigo: '23' },
  { nombre: 'La Concordia', provinciaCodigo: '23' },

  // 24 Santa Elena (3)
  { nombre: 'Santa Elena', provinciaCodigo: '24' },
  { nombre: 'La Libertad', provinciaCodigo: '24' },
  { nombre: 'Salinas', provinciaCodigo: '24' },
];
