export interface CategoriaSeed {
  nombre: string;
  icono: string;
  descripcion?: string;
  estado?: boolean;
}

export const CATEGORIAS_SEED: CategoriaSeed[] = [
  // Gastronomía y bebidas
  { nombre: 'Restaurantes', icono: 'restaurant' },
  { nombre: 'Comida rápida', icono: 'fastfood' },
  { nombre: 'Pizzerías', icono: 'pizza' },
  { nombre: 'Hamburgueserías', icono: 'burger' },
  { nombre: 'Parrilladas', icono: 'parrillada' },
  { nombre: 'Mariscos', icono: 'mariscos' },
  { nombre: 'Sushi', icono: 'sushi' },
  { nombre: 'Comida saludable', icono: 'saludable' },
  { nombre: 'Heladerías', icono: 'heladeria' },
  { nombre: 'Pastelerías', icono: 'postres' },
  { nombre: 'Panaderías', icono: 'panaderia' },
  { nombre: 'Cafeterías', icono: 'coffee' },
  { nombre: 'Bares', icono: 'bar' },
  { nombre: 'Discotecas', icono: 'disco' },
  { nombre: 'Licorerías', icono: 'licoreria' },
  { nombre: 'Food trucks', icono: 'foodtruck' },
  { nombre: 'Buffet', icono: 'buffet' },

  // Belleza y bienestar
  { nombre: 'Spa', icono: 'spa' },
  { nombre: 'Peluquería', icono: 'hair' },
  { nombre: 'Salón de belleza', icono: 'beauty' },
  { nombre: 'Manicure y Pedicure', icono: 'nails' },
  { nombre: 'Masajes', icono: 'masajes' },
  { nombre: 'Maquillaje', icono: 'maquillaje' },
  { nombre: 'Depilación', icono: 'depilacion' },
  { nombre: 'Tatuajes y Piercing', icono: 'tatuajes' },

  // Salud
  { nombre: 'Farmacia', icono: 'pharmacy' },
  { nombre: 'Clínica', icono: 'clinica' },
  { nombre: 'Odontología', icono: 'dentista' },
  { nombre: 'Óptica', icono: 'optica' },
  { nombre: 'Laboratorio clínico', icono: 'laboratorio' },
  { nombre: 'Psicología', icono: 'psicologia' },
  { nombre: 'Nutrición', icono: 'nutricion' },
  { nombre: 'Veterinaria', icono: 'veterinaria' },

  // Deporte y fitness
  { nombre: 'Deportes', icono: 'deportes' },
  { nombre: 'Gimnasio', icono: 'gym' },
  { nombre: 'Yoga y Pilates', icono: 'yoga' },
  { nombre: 'CrossFit', icono: 'crossfit' },
  { nombre: 'Artes marciales', icono: 'marciales' },
  { nombre: 'Natación', icono: 'natacion' },
  { nombre: 'Tenis', icono: 'tenis' },
  { nombre: 'Fútbol', icono: 'futbol' },
  { nombre: 'Básquet', icono: 'basquet' },
  { nombre: 'Ciclismo', icono: 'bike' },
  { nombre: 'Running', icono: 'running' },

  // Aventura y outdoor
  { nombre: 'Aventura', icono: 'aventura' },
  { nombre: 'Senderismo', icono: 'trekking' },
  { nombre: 'Camping', icono: 'camping' },
  { nombre: 'Escalada', icono: 'escalada' },
  { nombre: 'Parapente', icono: 'parapente' },
  { nombre: 'Rafting', icono: 'rafting' },
  { nombre: 'Buceo', icono: 'buceo' },
  { nombre: 'Surf', icono: 'surf' },
  { nombre: 'Pesca deportiva', icono: 'pesca' },
  { nombre: 'Kayak', icono: 'kayak' },
  { nombre: 'Equitación', icono: 'equitacion' },
  { nombre: 'Cuatrimotos', icono: 'atv' },
  { nombre: 'Paintball', icono: 'paintball' },
  { nombre: 'Tirolesa y Canopy', icono: 'canopy' },

  // Turismo y viajes
  { nombre: 'Hoteles', icono: 'hotel' },
  { nombre: 'Hostales', icono: 'hostal' },
  { nombre: 'Resort', icono: 'resort' },
  { nombre: 'Cabañas', icono: 'cabana' },
  { nombre: 'Agencias de viaje', icono: 'agencia' },
  { nombre: 'Tours', icono: 'tours' },
  { nombre: 'Playas', icono: 'beach' },
  { nombre: 'Termas', icono: 'termas' },
  { nombre: 'Aerolíneas', icono: 'aerolinea' },

  // Entretenimiento
  { nombre: 'Cine', icono: 'cinema' },
  { nombre: 'Teatro', icono: 'theater' },
  { nombre: 'Conciertos', icono: 'concierto' },
  { nombre: 'Karaoke', icono: 'karaoke' },
  { nombre: 'Bowling', icono: 'bowling' },
  { nombre: 'Billar', icono: 'billar' },
  { nombre: 'Videojuegos', icono: 'game' },
  { nombre: 'Casino', icono: 'casino' },
  { nombre: 'Parques de diversiones', icono: 'parquediv' },
  { nombre: 'Acuarios', icono: 'acuario' },
  { nombre: 'Zoológicos', icono: 'zoo' },
  { nombre: 'Museos', icono: 'museum' },
  { nombre: 'Galerías de arte', icono: 'galeria' },
  { nombre: 'Escape rooms', icono: 'escape' },
  { nombre: 'Eventos y Festivales', icono: 'eventos' },

  // Niños y familia
  { nombre: 'Juguetería', icono: 'jugueteria' },
  { nombre: 'Parques infantiles', icono: 'parqueinf' },
  { nombre: 'Guarderías', icono: 'guarderia' },
  { nombre: 'Ropa infantil', icono: 'ropainf' },

  // Educación
  { nombre: 'Cursos y Capacitaciones', icono: 'cursos' },
  { nombre: 'Idiomas', icono: 'idiomas' },
  { nombre: 'Música y Conservatorio', icono: 'music' },
  { nombre: 'Arte y Pintura', icono: 'arte' },
  { nombre: 'Librerías', icono: 'book' },

  // Compras y retail
  { nombre: 'Centro comercial', icono: 'mall' },
  { nombre: 'Supermercado', icono: 'market' },
  { nombre: 'Ropa y Boutique', icono: 'ropa' },
  { nombre: 'Calzado', icono: 'calzado' },
  { nombre: 'Joyería', icono: 'joyeria' },
  { nombre: 'Accesorios', icono: 'accesorios' },
  { nombre: 'Electrodomésticos', icono: 'electro' },
  { nombre: 'Tecnología y Electrónica', icono: 'tech' },
  { nombre: 'Celulares', icono: 'phone' },
  { nombre: 'Computadoras', icono: 'computer' },
  { nombre: 'Muebles', icono: 'muebles' },
  { nombre: 'Decoración y Hogar', icono: 'hogar' },
  { nombre: 'Florerías', icono: 'flores' },
  { nombre: 'Mascotas / Pet shop', icono: 'petshop' },
  { nombre: 'Regalos', icono: 'regalos' },
  { nombre: 'Tienda general', icono: 'shop' },

  // Servicios
  { nombre: 'Lavandería', icono: 'lavanderia' },
  { nombre: 'Tintorería', icono: 'tintoreria' },
  { nombre: 'Lavado de autos', icono: 'lavadoauto' },
  { nombre: 'Mecánica y Taller', icono: 'mecanica' },
  { nombre: 'Llantera', icono: 'llantera' },
  { nombre: 'Cerrajería', icono: 'cerrajeria' },
  { nombre: 'Plomería', icono: 'plomeria' },
  { nombre: 'Electricista', icono: 'electricista' },
  { nombre: 'Limpieza y Aseo', icono: 'limpieza' },
  { nombre: 'Mudanzas', icono: 'mudanza' },
  { nombre: 'Mensajería', icono: 'mensajeria' },
  { nombre: 'Imprenta', icono: 'imprenta' },
  { nombre: 'Fotografía y Estudio', icono: 'fotografia' },
  { nombre: 'Catering y Eventos', icono: 'catering' },
  { nombre: 'DJ y Música para eventos', icono: 'dj' },

  // Transporte
  { nombre: 'Taxi', icono: 'taxi' },
  { nombre: 'Bus', icono: 'bus' },
  { nombre: 'Renta de autos', icono: 'rentauto' },
  { nombre: 'Renta de motos', icono: 'rentamoto' },
  { nombre: 'Renta de bicicletas', icono: 'rentabike' },

  // Inmobiliario y construcción
  { nombre: 'Bienes raíces', icono: 'inmobiliaria' },
  { nombre: 'Construcción', icono: 'construccion' },
  { nombre: 'Arquitectura', icono: 'arquitectura' },
  { nombre: 'Diseño de interiores', icono: 'interiores' },

  // Financieros
  { nombre: 'Bancos', icono: 'banco' },
  { nombre: 'Seguros', icono: 'seguros' },
  { nombre: 'Casa de cambio', icono: 'cambio' },

  // Mascotas (servicios)
  { nombre: 'Peluquería canina', icono: 'pelucanina' },
  { nombre: 'Adiestramiento', icono: 'adiestramiento' },
  { nombre: 'Hotel para mascotas', icono: 'hotelpet' },
];

export const ICONO_KEYS: readonly string[] = Array.from(
  new Set(CATEGORIAS_SEED.map((c) => c.icono)),
);
