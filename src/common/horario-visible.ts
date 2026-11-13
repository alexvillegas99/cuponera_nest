/**
 * Horario que ve el cliente, armado SIEMPRE desde los datos estructurados de
 * la promoción (los mismos que valida el canje), para que nunca contradiga
 * lo que realmente aplica:
 *
 *   días   ← aplicaTodosLosDias / diasAplicables
 *   horas  ← horarioPorDia; si no hay, las horas que trae el texto libre
 *            `scheduleLabel` (datos antiguos)
 *   excepto← próximas fechasExcluidas (hoy en adelante, hora de Ecuador)
 *
 * Ej.: "Lun a Vie 09:00 a 23:00 · excepto 25/12 y 01/01"
 *
 * El `scheduleLabel` guardado no se modifica; esto solo afecta la respuesta.
 */

const ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const ABREV: Record<string, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sáb',
  domingo: 'Dom',
};

const norm = (s: string) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function unirConY(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

/** Índices (0=lunes) de los días en que aplica la promo. */
function indicesDias(dp: any): number[] {
  if (dp?.aplicaTodosLosDias !== false) return [0, 1, 2, 3, 4, 5, 6];
  const set = new Set((dp?.diasAplicables ?? []).map(norm));
  return ORDEN.map((d, i) => (set.has(d) ? i : -1)).filter((i) => i >= 0);
}

/** "Todos los días", "Lun a Vie", "Lun, Mié y Vie", "Lun a Jue y Dom". */
function nombrarDias(idx: number[]): string {
  if (!idx.length) return '';
  if (idx.length === 7) return 'Todos los días';
  const grupos: number[][] = [];
  for (const i of idx) {
    const g = grupos[grupos.length - 1];
    if (g && g[g.length - 1] === i - 1) g.push(i);
    else grupos.push([i]);
  }
  const partes = grupos.flatMap((g) =>
    g.length >= 3
      ? [`${ABREV[ORDEN[g[0]]]} a ${ABREV[ORDEN[g[g.length - 1]]]}`]
      : g.map((i) => ABREV[ORDEN[i]]),
  );
  return unirConY(partes);
}

export function etiquetaDias(dp: any): string {
  return nombrarDias(indicesDias(dp));
}

/** Convierte "9", "9:30", "9 am", "11:30 pm", "23:00 pm" → "HH:mm". */
function aHHmm(h: number, m: number, sufijo?: string): string | null {
  const s = (sufijo ?? '').replace(/\./g, '').toLowerCase();
  if (s === 'pm' && h < 12) h += 12;
  if (s === 'am' && h === 12) h = 0;
  if (h > 24 || m > 59) return null;
  if (h === 24) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Horas "HH:mm a HH:mm" sacadas del texto libre antiguo (scheduleLabel). */
export function etiquetaHoras(dp: any): string {
  const texto = String(dp?.scheduleLabel ?? '');
  // Solo cuenta como hora si tiene ":mm" o am/pm (evita "2x1", "12/11"…).
  const re = /(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?(?![\d/x])/gi;
  const horas: string[] = [];
  for (const m of texto.matchAll(re)) {
    if (!m[2] && !m[3]) continue;
    const v = aHHmm(Number(m[1]), Number(m[2] ?? 0), m[3]?.replace(/\s/g, ''));
    if (v) horas.push(v);
  }
  return horas.length >= 2 ? `${horas[0]} a ${horas[horas.length - 1]}` : '';
}

/** Próximas fechas excluidas como "dd/MM" (máx. 3). */
export function proximasExcluidas(dp: any, ahora = new Date()): string[] {
  const hoy = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
  return (dp?.fechasExcluidas ?? [])
    .map((f: any) => new Date(f))
    .filter((d: Date) => !isNaN(d.getTime()))
    .map((d: Date) => d.toISOString().slice(0, 10)) // fecha guardada a medianoche UTC
    .filter((ymd: string) => ymd >= hoy)
    .sort()
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    .slice(0, 3)
    .map((ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`);
}

/** Rango válido de horarioPorDia para un día, o null. */
function rangoDia(dp: any, dia: string): string | null {
  const h = dp?.horarioPorDia?.[dia];
  const abre = String(h?.abre ?? '').slice(0, 5);
  const cierra = String(h?.cierra ?? '').slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(abre) || !/^\d{2}:\d{2}$/.test(cierra)) return null;
  if (abre === cierra) return null; // dato inválido (p. ej. 09:00 a 09:00)
  return `${abre} a ${cierra}`;
}

export function horarioVisible(dp: any, ahora = new Date()): string {
  if (!dp) return '';
  const idx = indicesDias(dp);
  if (!idx.length) return ''; // sin días marcados no hay nada que mostrar
  const partes: string[] = [];

  // Horario por día guardado (si cubre todos los días en que aplica).
  const rangos = idx.map((i) => rangoDia(dp, ORDEN[i]));
  if (idx.length && rangos.every(Boolean)) {
    const grupos = new Map<string, number[]>();
    idx.forEach((i, k) => {
      const r = rangos[k] as string;
      grupos.set(r, [...(grupos.get(r) ?? []), i]);
    });
    for (const [r, dias] of grupos) partes.push(`${nombrarDias(dias)} ${r}`);
  } else {
    const base = [nombrarDias(idx), etiquetaHoras(dp)].filter(Boolean).join(' ');
    if (base) partes.push(base);
  }

  const exc = proximasExcluidas(dp, ahora);
  if (exc.length) partes.push(`excepto ${unirConY(exc)}`);
  return partes.join(' · ');
}
