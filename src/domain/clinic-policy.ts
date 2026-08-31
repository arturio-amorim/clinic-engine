import type {
  AppointmentType,
  ClinicPolicy,
  Practitioner,
} from "./types.js";

export const clinicPolicy: ClinicPolicy = Object.freeze({
  name: "Clínica Horizonte",
  timeZone: "America/Sao_Paulo",
  utcOffset: "-03:00",
  slotIntervalMinutes: 10,
  bufferMinutes: 10,
  minNoticeMinutes: 120,
  maxListedSlots: 16,
  defaultLookaheadDays: 7,
  durations: Object.freeze({
    "consulta-geral": 30,
    retorno: 20,
    exame: 45,
  }),
  hours: Object.freeze([
    Object.freeze({ weekday: 1, open: "08:00", close: "18:00" }),
    Object.freeze({ weekday: 2, open: "08:00", close: "18:00" }),
    Object.freeze({ weekday: 3, open: "08:00", close: "18:00" }),
    Object.freeze({ weekday: 4, open: "08:00", close: "18:00" }),
    Object.freeze({ weekday: 5, open: "08:00", close: "18:00" }),
    Object.freeze({ weekday: 6, open: "08:00", close: "12:00" }),
  ]),
  practitioners: Object.freeze([
    Object.freeze({
      id: "dra-ana-souza",
      name: "Dra. Ana Souza",
      appointmentTypes: Object.freeze(["consulta-geral", "retorno"] as const),
    }),
    Object.freeze({
      id: "dr-carlos-mendes",
      name: "Dr. Carlos Mendes",
      appointmentTypes: Object.freeze(["consulta-geral", "exame"] as const),
    }),
  ]),
});

export function findPractitioner(
  policy: ClinicPolicy,
  practitionerId: string,
): Practitioner | undefined {
  return policy.practitioners.find(
    (practitioner) => practitioner.id === practitionerId,
  );
}

export function practitionersForType(
  policy: ClinicPolicy,
  appointmentType: AppointmentType,
  practitionerId?: string,
): readonly Practitioner[] {
  return policy.practitioners.filter((practitioner) => {
    if (!practitioner.appointmentTypes.includes(appointmentType)) return false;
    if (practitionerId !== undefined && practitioner.id !== practitionerId) {
      return false;
    }
    return true;
  });
}

export function durationFor(
  policy: ClinicPolicy,
  appointmentType: AppointmentType,
): number {
  return policy.durations[appointmentType];
}
