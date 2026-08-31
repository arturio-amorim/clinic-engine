export const appointmentTypes = ["consulta-geral", "retorno", "exame"] as const;

export type AppointmentType = (typeof appointmentTypes)[number];

export const appointmentStatuses = ["confirmed", "cancelled"] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];

export interface Practitioner {
  readonly id: string;
  readonly name: string;
  readonly appointmentTypes: readonly AppointmentType[];
}

export interface WeeklyHours {
  readonly weekday: number;
  readonly open: string;
  readonly close: string;
}

export interface ClinicPolicy {
  readonly name: string;
  readonly timeZone: string;
  readonly utcOffset: string;
  readonly slotIntervalMinutes: number;
  readonly bufferMinutes: number;
  readonly minNoticeMinutes: number;
  readonly maxListedSlots: number;
  readonly defaultLookaheadDays: number;
  readonly durations: Readonly<Record<AppointmentType, number>>;
  readonly hours: readonly WeeklyHours[];
  readonly practitioners: readonly Practitioner[];
}

export interface Appointment {
  readonly id: string;
  readonly practitionerId: string;
  readonly patientName: string;
  readonly patientPhone?: string;
  readonly appointmentType: AppointmentType;
  readonly start: string;
  readonly end: string;
  readonly status: AppointmentStatus;
}

export interface Slot {
  readonly practitionerId: string;
  readonly practitionerName: string;
  readonly appointmentType: AppointmentType;
  readonly start: string;
  readonly end: string;
  readonly durationMinutes: number;
}

export interface Clock {
  now(): Date;
}
