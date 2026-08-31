const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const clockPattern = /^(\d{2}):(\d{2})$/;

export function parseLocalDate(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = datePattern.exec(value);
  if (match === null) {
    throw new RangeError(`Invalid local date: ${value}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function formatLocalDate(date: Date, utcOffset: string): string {
  const shifted = new Date(date.getTime() + offsetToMinutes(utcOffset) * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateTime(
  date: string,
  time: string,
  utcOffset: string,
): Date {
  const clock = clockPattern.exec(time);
  if (clock === null) {
    throw new RangeError(`Invalid local time: ${time}`);
  }
  return new Date(`${date}T${time}:00${utcOffset}`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function toIso(date: Date): string {
  return date.toISOString();
}

export function weekdayInOffset(date: Date, utcOffset: string): number {
  const shifted = new Date(date.getTime() + offsetToMinutes(utcOffset) * 60_000);
  return shifted.getUTCDay();
}

export function offsetToMinutes(utcOffset: string): number {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(utcOffset);
  if (match === null) {
    throw new RangeError(`Invalid UTC offset: ${utcOffset}`);
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

export function overlapsWithBuffer(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
  bufferMinutes: number,
): boolean {
  const bufferMs = bufferMinutes * 60_000;
  return (
    leftStart.getTime() < rightEnd.getTime() + bufferMs &&
    rightStart.getTime() < leftEnd.getTime() + bufferMs
  );
}

export function addDays(date: string, days: number): string {
  const parsed = parseLocalDate(date);
  const utc = Date.UTC(parsed.year, parsed.month - 1, parsed.day + days);
  const next = new Date(utc);
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
