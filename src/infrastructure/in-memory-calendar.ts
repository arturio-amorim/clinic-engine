import { randomUUID } from "node:crypto";

import type { Appointment } from "../domain/types.js";
import type { CalendarPort } from "../application/ports.js";

export function createInMemoryCalendar(
  seed: readonly Appointment[] = [],
): CalendarPort {
  const appointments = new Map<string, Appointment>(
    seed.map((appointment) => [appointment.id, appointment]),
  );

  return {
    async listBusy({ start, end, practitionerId, signal }) {
      signal.throwIfAborted();
      return [...appointments.values()].filter((appointment) => {
        if (appointment.status !== "confirmed") return false;
        if (
          practitionerId !== undefined &&
          appointment.practitionerId !== practitionerId
        ) {
          return false;
        }
        const appointmentStart = new Date(appointment.start);
        const appointmentEnd = new Date(appointment.end);
        return (
          appointmentStart.getTime() < end.getTime() &&
          appointmentEnd.getTime() > start.getTime()
        );
      });
    },

    async getAppointment(appointmentId, { signal }) {
      signal.throwIfAborted();
      return appointments.get(appointmentId) ?? null;
    },

    async createAppointment(appointment, { signal }) {
      signal.throwIfAborted();
      if (appointments.has(appointment.id)) {
        throw new Error("Appointment id already exists.");
      }
      appointments.set(appointment.id, appointment);
      return appointment;
    },

    async updateAppointment(appointment, { signal }) {
      signal.throwIfAborted();
      appointments.set(appointment.id, appointment);
      return appointment;
    },
  };
}

export function createIdFactory(): () => string {
  return () => `apt_${randomUUID()}`;
}
