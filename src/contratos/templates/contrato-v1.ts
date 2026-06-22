/**
 * Template v1 del contrato de cooperación entre Club Enjoy y el local.
 *
 * Es el texto LEGAL exacto provisto por el equipo. Las llaves dobles
 * `{{...}}` se reemplazan al renderizar. Mantener este template versionado:
 * cuando se quiera cambiar el texto crear `contrato-v2.ts` para no romper
 * la historia de los locales que ya firmaron la v1.
 */

export interface DatosContratoV1 {
  // Local
  nombreLocal: string;
  representanteLegal: string;
  cedulaRepresentante: string;
  estadoCivilRepresentante?: string;
  rucLocal?: string;
  direccionLocal?: string;
  celularLocal?: string;

  // Fecha en formato literal: "12 días del mes de junio del año 2026"
  fechaLiteral: string;

  // Constantes (parametrizables a futuro)
  cedulaContratado?: string; // 1802497279
  rucContratado?: string;
  multaIncumplimiento?: string; // "500,oo USD"
  diasNotificacion?: string; // "15"
}

export interface ContratoRenderizado {
  titulo: string;
  bloques: ContratoBloque[];
}

export type ContratoBloque =
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; items: string[] };

export function renderContratoV1(d: DatosContratoV1): ContratoRenderizado {
  const cedulaContratado = d.cedulaContratado ?? '1802497279';
  const rucContratado = d.rucContratado ?? 'XXXXXXXXXX';
  const multa = d.multaIncumplimiento ?? '500,oo';
  const diasNotif = d.diasNotificacion ?? '15';

  const nombreLocal = d.nombreLocal || '__________';
  const ruc = d.rucLocal || '__________';
  const repre = d.representanteLegal || '__________';
  const cedRepre = d.cedulaRepresentante || '__________';
  const ecRepre = d.estadoCivilRepresentante || '__________';
  const direccion = d.direccionLocal || '__________';
  const celular = d.celularLocal || '__________';

  return {
    titulo: 'CONTRATO DE COOPERACIÓN ENTRE MARCAS',
    bloques: [
      {
        tipo: 'parrafo',
        texto: `En la ciudad de Ambato, ${d.fechaLiteral}, comparecen, por una parte, CLUB ENJOY, con número de RUC ${rucContratado}, legalmente representada por el señor JHON XXXXX, portador de la cédula de ciudadanía N° ${cedulaContratado}, mayor de edad, quien comparece en calidad de CONTRATADO; y, por otra parte, el señor ${repre}, representante legal de la empresa / restaurante / local comercial de nombre ${nombreLocal}, portador de la cédula de ciudadanía N° ${cedRepre}, mayor de edad, de estado civil ${ecRepre}, quien comparece en calidad de CONTRATANTE.`,
      },
      {
        tipo: 'parrafo',
        texto: `Los comparecientes son ecuatorianos, domiciliados en la ciudad de Ambato, libres y capaces para contratar, quienes libre y voluntariamente convienen en celebrar este CONTRATO, con sujeción a las declaraciones y estipulaciones contenidas en las siguientes cláusulas. Al CONTRATANTE y CONTRATADO en adelante se los denominará conjuntamente como "Partes" e individualmente como "Parte".`,
      },

      { tipo: 'titulo', texto: 'CLÁUSULA PRIMERA: ANTECEDENTES' },
      {
        tipo: 'parrafo',
        texto:
          '1. CLUB ENJOY es una compañía ecuatoriana legalmente constituida, misma que se encuentra ubicada en la ciudad de Cevallos, Provincia de Tungurahua.',
      },
      {
        tipo: 'parrafo',
        texto:
          '2. ENJOY es una plataforma creada para brindar beneficios mediante promociones en consumo de varios locales comerciales, que opera a través de una aplicación digital, mediante la cual las personas que se encuentren suscritas tendrán acceso a descuentos, promociones y beneficios ofrecidos por los locales comerciales afiliados a la plataforma ENJOY.',
      },
      {
        tipo: 'parrafo',
        texto:
          '3. CLUB ENJOY se dedica a la distribución profesional y estratégica de membresías temporales para consumidores que se suscriban a la plataforma ENJOY, misma que distribuye periódicamente promociones de locales comerciales como son restaurantes, gimnasios, centros comerciales, tiendas de regalos, y todos los locales que se encuentren asociados a la plataforma ENJOY, satisfaciendo así tanto a los consumidores como a los locales comerciales. Además, busca impulsar las ventas de todos los locales comerciales afiliados, mediante la distribución estratégica de las promociones en redes sociales, de una manera profesional, analizando las estadísticas de ventas semanales y mensuales de cada uno de los locales comerciales, para así impulsar sus ventas en los días menos concurridos por los consumidores y mejorar la calidad de los consumidores con los locales comerciales.',
      },

      { tipo: 'titulo', texto: 'CLÁUSULA SEGUNDA: OBJETO' },
      {
        tipo: 'parrafo',
        texto: `El objeto del presente contrato es realizar una cooperación entre ambas marcas, incorporando así al local comercial denominado ${nombreLocal} a la lista de locales comerciales afiliados a la compañía CLUB ENJOY, misma que desde la suscripción del presente contrato hasta su caducidad, se obliga a publicitar de manera profesional la imagen del local comercial, además de distribuir permanentemente los beneficios promocionales ofertados por el local comercial para que los consumidores puedan acceder a ellos mediante la suscripción a la plataforma ENJOY.`,
      },
      {
        tipo: 'parrafo',
        texto:
          'Es menester dejar claro que el presente contrato no involucra ningún tipo de relación laboral entre las partes, estableciendo que únicamente las partes se sirven como apoyo para poder impulsar cada una de las marcas, dejando claro que cada una de las partes es independiente la una de la otra.',
      },

      { tipo: 'titulo', texto: 'CLÁUSULA TERCERA: OBLIGACIONES DEL LOCAL COMERCIAL' },
      { tipo: 'parrafo', texto: 'El AFILIADO se obliga a:' },
      {
        tipo: 'lista',
        items: [
          'a) Honrar y aplicar a todos los Socios los Beneficios ofrecidos mediante el aplicativo móvil, sin condicionarlos a montos mínimos de consumo distintos a los pactados en la aplicación, ni excluir productos o servicios no exceptuados expresamente.',
          'b) Mantener los Beneficios activos y disponibles durante todo el horario de atención dentro del local comercial, en igualdad de condiciones de calidad, precio y servicio que para el público en general.',
          'c) Validar cada Beneficio exclusivamente a través de la Plataforma, mediante el escaneo del código QR del Cupón del Socio, absteniéndose de aceptar cupones que no provengan oficialmente del CLUB ENJOY.',
          'd) Designar y capacitar al personal responsable de validar los Cupones y de operar el panel del AFILIADO, y mantener actualizada la lista de empleados autorizados.',
          'e) Entregar a ENJOY información veraz y actualizada del establecimiento (datos de contacto, dirección, horarios, fotografías, menú o catálogo) para su publicación en la Plataforma, y autorizar su uso para fines de promoción y publicidad del local comercial.',
          `f) Notificar a ENJOY, con al menos ${diasNotif} días de anticipación, cualquier cambio en los Beneficios, horarios, ubicación o cierre temporal o definitivo del establecimiento.`,
          'g) Cumplir con la normativa aplicable, incluyendo la Ley Orgánica de Defensa del Consumidor, normas sanitarias, tributarias y municipales, y mantener vigentes los permisos de funcionamiento.',
          'h) Atender favorablemente todos y cada uno de los reclamos de los Socios relacionados con los Beneficios promocionales, y mantener un estándar de servicio adecuado para que el consumidor tenga una óptima experiencia.',
          'i) Pagar a CLUB ENJOY el valor económico pactado entre las partes, esto será al momento de la suscripción del presente contrato.',
          'j) Abstenerse de usar las marcas, signos distintivos o contenidos de CLUB ENJOY fuera de lo autorizado en este Contrato.',
        ],
      },

      { tipo: 'titulo', texto: 'CLÁUSULA CUARTA: OBLIGACIONES DE CLUB ENJOY' },
      { tipo: 'parrafo', texto: 'ENJOY se obliga a:' },
      {
        tipo: 'lista',
        items: [
          'a) Incorporar al AFILIADO a la lista de locales comerciales vigentes hasta la presente fecha, incluirlo en el aplicativo móvil ENJOY, publicitar al local comercial y difundir sus Beneficios entre los suscriptores del aplicativo móvil.',
          'b) Poner a disposición del AFILIADO el acceso a la Plataforma y al panel de administración para la validación de Cupones y la gestión de su perfil.',
          'c) Proporcionar al AFILIADO reportes y estadísticas de canjes, suscripciones y desempeño del local comercial, conforme a las funcionalidades de la Plataforma.',
          'd) Brindar soporte y capacitación frecuente para el uso de la Plataforma y la validación de Cupones, siempre que el local comercial así lo necesitare.',
          'e) Realizar acciones de promoción y marketing del local comercial, que beneficien la difusión de la red de establecimientos afiliados, conforme a su estrategia comercial.',
          'f) Emitir el comprobante de venta por la afiliación del local comercial con CLUB ENJOY a la fecha de suscripción del presente contrato.',
          'g) Tratar la información y los Datos Personales a los que tenga acceso conforme a lo establecido por la Ley Orgánica de Protección de Datos Personales.',
          'h) Notificar oportunamente al local comercial cualquier suspensión, mantenimiento o cambio relevante de la Plataforma.',
        ],
      },

      { tipo: 'titulo', texto: 'CLÁUSULA QUINTA: EXCLUSIVIDAD' },
      {
        tipo: 'parrafo',
        texto: `CLUB ENJOY y el local comercial denominado ${nombreLocal} acuerdan que el local comercial se compromete a, bajo ninguna circunstancia, trabajar con otro aplicativo móvil con el cual ya haya tenido contacto anteriormente, y, mucho menos que ofrezca las mismas promociones de CLUB ENJOY, todo esto posterior a la suscripción de este instrumento.`,
      },

      { tipo: 'titulo', texto: 'CLÁUSULA SEXTA: CONFIDENCIALIDAD' },
      {
        tipo: 'parrafo',
        texto:
          'Las Partes mantendrán absoluta y discreta confidencialidad de la Información percibida, tanto del local comercial como información de funcionamiento y manejo del aplicativo móvil, y no la divulgarán a terceros sin autorización escrita, salvo requerimiento de autoridad competente. Esta obligación subsistirá hasta por 1 año luego de terminado el Contrato.',
      },

      { tipo: 'titulo', texto: 'CLÁUSULA SÉPTIMA: PROTECCIÓN DE DATOS PERSONALES' },
      {
        tipo: 'parrafo',
        texto:
          'Las partes se comprometen a proteger y administrar de manera correcta y segura los datos personales de todas las personas que consuman productos o servicios dentro de los locales comerciales y a través del aplicativo móvil, todo esto conforme a la Ley Orgánica de Protección de Datos Personales vigente en la República del Ecuador.',
      },
      {
        tipo: 'parrafo',
        texto: `Los Datos Personales de los suscriptores son tratados por ENJOY en calidad de responsable. El local comercial ${nombreLocal} solo podrá tratar los datos a los que acceda para la validación de Beneficios y no los empleará para fines propios, de marketing directo, ni los cederá a terceros, salvo autorización expresa.`,
      },
      {
        tipo: 'parrafo',
        texto:
          'Tal como lo manda el artículo 66, numeral 19 de la Constitución de la República del Ecuador.',
      },

      { tipo: 'titulo', texto: 'CLÁUSULA OCTAVA: RESPONSABILIDAD DE HIGIENE Y CALIDAD' },
      {
        tipo: 'parrafo',
        texto: `Cada Parte responderá por los daños directos que cause a la otra por dolo o culpa en el cumplimiento del Contrato. ENJOY no será responsable por la calidad de los productos o servicios prestados por ${nombreLocal} a los consumidores, que son de exclusiva responsabilidad del local comercial. ${nombreLocal} mantendrá indemne a ENJOY frente a reclamos de los consumidores o terceros derivados de sus productos, servicios o del incumplimiento de sus obligaciones; además será el único responsable de la higiene y presentación del local comercial.`,
      },

      { tipo: 'titulo', texto: 'CLÁUSULA NOVENA: DISPOSICIONES GENERALES' },
      {
        tipo: 'parrafo',
        texto:
          'Este contrato y sus anexos constituyen el acuerdo total entre las partes y dejan sin efecto cualquier entendimiento anterior sobre la misma materia. Toda modificación que se considere necesaria deberá constar por escrito, la misma deberá estar suscrita y aceptada por ambas Partes. Si alguna cláusula fuere declarada nula o inejecutable, las demás conservarán su validez. Todo contrato legalmente celebrado es una ley para los contratantes, y no puede ser invalidado sino por su consentimiento mutuo o por causas legales, tal como lo establece el artículo 1561 del Código Civil ecuatoriano.',
      },

      { tipo: 'titulo', texto: 'CLÁUSULA DÉCIMA: DURACIÓN DEL CONTRATO Y RENOVACIÓN' },
      {
        tipo: 'parrafo',
        texto:
          'El presente contrato tendrá la vigencia de un año a partir de su suscripción y podrá ser renovado siempre y cuando las partes se encuentren de acuerdo al término del presente contrato. Para lo cual, se deberá realizar un nuevo instrumento en el cual consten las mismas cláusulas, o de ser necesario, agregar cláusulas específicas; finalmente, deberá ser firmado el nuevo instrumento.',
      },

      { tipo: 'titulo', texto: 'CLÁUSULA DÉCIMA PRIMERA: FORMAS DE TERMINACIÓN DEL CONTRATO' },
      {
        tipo: 'parrafo',
        texto:
          'Las razones por las cuales se puede dar por terminado el presente instrumento de manera anticipada son aquellas que se encuentran plasmadas en el Código Civil ecuatoriano vigente. Otra manera de dar por terminado el presente contrato es mediante acuerdo entre las partes de manera verbal o mediante acuerdo de terminación por escrito; es oportuno mencionar que para que se pueda finiquitar la validez del presente instrumento, ambas partes deben estar de acuerdo.',
      },

      {
        tipo: 'titulo',
        texto: 'CLÁUSULA DÉCIMA SEGUNDA: CLÁUSULA PENAL POR INCUMPLIMIENTO',
      },
      {
        tipo: 'parrafo',
        texto: `En caso de que una de las dos partes llegare a incumplir con una, o varias cláusulas del presente instrumento, deberá resarcir a la otra parte con una multa económica del valor de ${multa} DÓLARES DE LOS ESTADOS UNIDOS DE NORTEAMÉRICA ($${multa}), mismos que serán pagados de manera inmediata una vez que se pruebe el incumplimiento de contrato.`,
      },

      { tipo: 'titulo', texto: 'CLÁUSULA DÉCIMA TERCERA: MEDIACIÓN Y CONTROVERSIAS' },
      {
        tipo: 'parrafo',
        texto:
          'En caso de la existencia de cualquier tipo de controversias, las partes se comprometen a tratar de solucionar dichas controversias en un centro de mediación y arbitraje de la ciudad de Ambato, con el fin de solucionar los problemas existentes.',
      },

      { tipo: 'titulo', texto: 'CLÁUSULA DÉCIMA CUARTA: JURISDICCIÓN Y COMPETENCIA' },
      {
        tipo: 'parrafo',
        texto:
          'En caso de suscitarse discrepancias en la interpretación, cumplimiento y ejecución del presente Contrato, y cuando no fuere posible llegar a un acuerdo amistoso entre las Partes, estas se someterán a los jueces competentes de la ciudad de Ambato, provincia de Tungurahua.',
      },

      { tipo: 'titulo', texto: 'ACEPTACIÓN' },
      {
        tipo: 'parrafo',
        texto:
          'Las partes aceptan todas y cada una de las cláusulas plasmadas en el presente instrumento por así convenir, para lo cual plasman su firma y rúbrica por duplicado, debiendo entregarse una copia a cada parte.',
      },
      {
        tipo: 'parrafo',
        texto: `CLUB ENJOY — RUC: ${rucContratado}`,
      },
      {
        tipo: 'parrafo',
        texto: `${nombreLocal} — RUC: ${ruc}\nRepresentante: ${repre} (C.I. ${cedRepre})\nDirección: ${direccion}\nCelular: ${celular}`,
      },
    ],
  };
}
