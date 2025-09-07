// src/common/datetime.service.ts
import { Injectable } from '@nestjs/common';

export type ECFormatOptions = {
  withTZ?: boolean; // agrega "GMT-5"
};

@Injectable()
export class DateTimeService {
  private readonly locale = 'es-EC';
  private readonly timeZone = 'America/Guayaquil';

  /**
   * Devuelve "dd/mm/yyyy HH:mm:ss" (24h) en zona de Ecuador.
   * Acepta Date | number (ms) | string parseable por Date.
   */
  formatEC(input?: Date | number | string, opts: ECFormatOptions = {}): string {
    const date = this.normalize(input);
    const parts = new Intl.DateTimeFormat(this.locale, {
      timeZone: this.timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      ...(opts.withTZ ? { timeZoneName: 'short' as const } : {}),
    }).formatToParts(date);

    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find(p => p.type === t)?.value ?? '';

    const base = `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
    if (opts.withTZ) {
      const tz = get('timeZoneName');
      return tz ? `${base} ${tz}` : base;
    }
    return base;
  }

  /** Ahora mismo formateado para EC. */
  nowEC(opts: ECFormatOptions = {}): string {
    return this.formatEC(new Date(), opts);
  }

  /** Normaliza la entrada a Date válida. */
  private normalize(input?: Date | number | string): Date {
    if (input instanceof Date) return input;
    if (typeof input === 'number') return new Date(input);
    if (typeof input === 'string') return new Date(input);
    return new Date();
  }
}
