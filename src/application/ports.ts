import type { Appointment, Clock } from "../domain/types.js";

export interface CalendarPort {
  listBusy(range: {
    readonly start: Date;
    readonly end: Date;
    readonly practitionerId?: string;
    readonly signal: AbortSignal;
  }): Promise<readonly Appointment[]>;
  getAppointment(
    appointmentId: string,
    options: { readonly signal: AbortSignal },
  ): Promise<Appointment | null>;
  createAppointment(
    appointment: Appointment,
    options: { readonly signal: AbortSignal },
  ): Promise<Appointment>;
  updateAppointment(
    appointment: Appointment,
    options: { readonly signal: AbortSignal },
  ): Promise<Appointment>;
}

export interface ClinicDependencies {
  readonly calendar: CalendarPort;
  readonly clock: Clock;
  readonly createId: () => string;
}
