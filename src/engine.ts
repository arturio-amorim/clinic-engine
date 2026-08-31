import { createEngine, type Principal } from "@senda/core";

import type { ClinicDependencies } from "./application/ports.js";
import { createCancel } from "./capabilities/cancel.js";
import { createListValidSlots } from "./capabilities/list-valid-slots.js";
import { createReschedule } from "./capabilities/reschedule.js";
import { createSchedule } from "./capabilities/schedule.js";
import type { Appointment } from "./domain/types.js";
import { createIdFactory, createInMemoryCalendar } from "./infrastructure/in-memory-calendar.js";

export const localPrincipal: Principal = Object.freeze({
  id: "local:clinic-desk",
});

const demoNow = new Date("2026-09-07T11:00:00-03:00");

const seededAppointments: readonly Appointment[] = [
  {
    id: "apt_seed_ana_0900",
    practitionerId: "dra-ana-souza",
    patientName: "Marina Costa",
    appointmentType: "consulta-geral",
    start: "2026-09-07T12:00:00.000Z",
    end: "2026-09-07T12:30:00.000Z",
    status: "confirmed",
  },
  {
    id: "apt_seed_carlos_1000",
    practitionerId: "dr-carlos-mendes",
    patientName: "Paulo Henrique",
    appointmentType: "exame",
    start: "2026-09-07T13:00:00.000Z",
    end: "2026-09-07T13:45:00.000Z",
    status: "confirmed",
  },
];

export function createClinicEngine(dependencies: ClinicDependencies) {
  return createEngine({
    name: "clinic-engine",
    version: "0.1.0",
    capabilities: {
      "appointments.list-valid-slots": createListValidSlots(dependencies),
      "appointments.schedule": createSchedule(dependencies),
      "appointments.reschedule": createReschedule(dependencies),
      "appointments.cancel": createCancel(dependencies),
    },
  });
}

export function createDefaultClinicEngine(
  overrides: Partial<ClinicDependencies> = {},
) {
  return createClinicEngine({
    calendar: overrides.calendar ?? createInMemoryCalendar(seededAppointments),
    clock: overrides.clock ?? { now: () => new Date(demoNow) },
    createId: overrides.createId ?? createIdFactory(),
  });
}

export const engine = createDefaultClinicEngine();
