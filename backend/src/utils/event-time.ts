import type { EventEffectiveStatus, EventStatus } from "@rollo/shared";

export type EventDateInfo = {
  startDate: string;
  endDate: string;
  timezone: string;
  status: EventStatus;
};

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localParts(date: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function isoDateOf(parts: Pick<LocalParts, "year" | "month" | "day">): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function eventDayInTimezone(timezone: string, now: Date): string {
  return isoDateOf(localParts(now, timezone));
}

function parseIsoDate(isoDate: string): [number, number, number] {
  const parts = isoDate.split("-");
  return [Number(parts[0] ?? 0), Number(parts[1] ?? 0), Number(parts[2] ?? 0)];
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = parseIsoDate(isoDate);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function utcDayNumber(isoDate: string): number {
  const [year, month, day] = parseIsoDate(isoDate);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function dayNumberFor(startDate: string, day: string): number {
  return Math.max(utcDayNumber(day) - utcDayNumber(startDate) + 1, 1);
}

export function totalDaysFor(startDate: string, endDate: string): number {
  return Math.max(utcDayNumber(endDate) - utcDayNumber(startDate) + 1, 1);
}

export function isWithinEventDates(event: EventDateInfo, day: string): boolean {
  return day >= event.startDate && day <= event.endDate;
}

/**
 * El estado efectivo ajusta el estado almacenado a las fechas actuales sin
 * modificarlo en la base de datos.
 */
export function effectiveStatus(event: EventDateInfo, now: Date): EventEffectiveStatus {
  if (event.status === "draft" || event.status === "cancelled") {
    return event.status;
  }

  if (event.status === "finished") {
    return "finished";
  }

  const day = eventDayInTimezone(event.timezone, now);

  if (day < event.startDate) {
    return "scheduled";
  }

  if (day > event.endDate) {
    return "out_of_dates";
  }

  return "active";
}

function offsetMilliseconds(timezone: string, date: Date): number {
  const parts = localParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

/**
 * Convierte una hora local del evento (por ejemplo, medianoche) al instante UTC
 * correspondiente. Repite el cálculo del offset para resolver los cambios de
 * horario de verano.
 */
function zonedTimeToUtc(year: number, month: number, day: number, timezone: string): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const firstOffset = offsetMilliseconds(timezone, new Date(utcGuess));
  let timestamp = utcGuess - firstOffset;
  const secondOffset = offsetMilliseconds(timezone, new Date(timestamp));

  if (secondOffset !== firstOffset) {
    timestamp = utcGuess - secondOffset;
  }

  return new Date(timestamp);
}

/**
 * Instante UTC de la próxima medianoche en la zona del evento. Es el momento
 * en que se renueva la cuota diaria.
 */
export function nextQuotaReset(timezone: string, now: Date): Date {
  const parts = localParts(now, timezone);
  const tomorrow = addDaysToIsoDate(isoDateOf(parts), 1);
  const [year, month, day] = parseIsoDate(tomorrow);

  return zonedTimeToUtc(year, month, day, timezone);
}
