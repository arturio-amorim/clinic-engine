import { defineCapability } from "@invokta/core";
import { z } from "zod";

import type { ClinicDependencies } from "../application/ports.js";
import { clinicPolicy, findPractitioner } from "../domain/clinic-policy.js";
import { domainFailure, requirePrincipal } from "../domain/errors.js";
import { slotIsBookable } from "../domain/slot-finder.js";
import { addDays, formatLocalDate, localDateTime, toIso } from "../domain/time.js";
import {
  appointmentTypeSchema,
  isoDateTimeSchema,
  patientNameSchema,
} from "./schemas.js";

const input = z.object({
  patientName: patientNameSchema,
  patientPhone: z.string().trim().min(8).max(32).optional(),
  appointmentType: appointmentTypeSchema,
  practitionerId: z.string().trim().min(1),
  start: isoDateTimeSchema,
});

const output = z.object({
  appointmentId: z.string(),
  status: z.literal("confirmed"),
  practitionerId: z.string(),
  practitionerName: z.string(),
  patientName: z.string(),
  appointmentType: appointmentTypeSchema,
  start: z.string(),
  end: z.string(),
});

export function createSchedule({ calendar, clock, createId }: ClinicDependencies) {
  return defineCapability({
    title: "Schedule appointment",
    description:
      "Revalida o horário escolhido, aplica a política da clínica e grava o agendamento confirmado.",
    input,
    output,
    access: "authenticated",
    timeoutMs: 20_000,
    annotations: {
      readOnly: false,
      destructive: false,
      idempotent: false,
      openWorld: false,
    },
    async run({ input: request, context }) {
      requirePrincipal(context.principal);
      const practitioner = findPractitioner(clinicPolicy, request.practitionerId);
      if (practitioner === undefined) {
        throw domainFailure("Unknown practitioner.", {
          practitionerId: request.practitionerId,
        });
      }

      const now = clock.now();
      const start = new Date(request.start);
      const localDate = formatLocalDate(start, clinicPolicy.utcOffset);
      const busy = await calendar.listBusy({
        start: localDateTime(localDate, "00:00", clinicPolicy.utcOffset),
        end: localDateTime(addDays(localDate, 1), "00:00", clinicPolicy.utcOffset),
        practitionerId: request.practitionerId,
        signal: context.signal,
      });
      const bookable = slotIsBookable({
        policy: clinicPolicy,
        appointmentType: request.appointmentType,
        practitionerId: request.practitionerId,
        start,
        now,
        busy,
      });
      if (!bookable.ok) {
        throw domainFailure(bookable.reason, { start: request.start });
      }

      const appointment = await calendar.createAppointment(
        {
          id: createId(),
          practitionerId: request.practitionerId,
          patientName: request.patientName,
          ...(request.patientPhone === undefined
            ? {}
            : { patientPhone: request.patientPhone }),
          appointmentType: request.appointmentType,
          start: toIso(start),
          end: toIso(bookable.end),
          status: "confirmed",
        },
        { signal: context.signal },
      );

      return {
        appointmentId: appointment.id,
        status: "confirmed" as const,
        practitionerId: appointment.practitionerId,
        practitionerName: practitioner.name,
        patientName: appointment.patientName,
        appointmentType: appointment.appointmentType,
        start: appointment.start,
        end: appointment.end,
      };
    },
  });
}
