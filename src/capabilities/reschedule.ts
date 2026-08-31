import { defineCapability } from "@senda/core";
import { z } from "zod";

import type { ClinicDependencies } from "../application/ports.js";
import { clinicPolicy, findPractitioner } from "../domain/clinic-policy.js";
import { domainFailure, requirePrincipal } from "../domain/errors.js";
import { slotIsBookable } from "../domain/slot-finder.js";
import { addDays, addMinutes, formatLocalDate, localDateTime, toIso } from "../domain/time.js";
import { isoDateTimeSchema, appointmentIdSchema } from "./schemas.js";

const input = z.object({
  appointmentId: appointmentIdSchema,
  start: isoDateTimeSchema,
  practitionerId: z.string().trim().min(1).optional(),
});

const output = z.object({
  appointmentId: z.string(),
  status: z.literal("confirmed"),
  practitionerId: z.string(),
  practitionerName: z.string(),
  patientName: z.string(),
  appointmentType: z.string(),
  start: z.string(),
  end: z.string(),
  previousStart: z.string(),
});

export function createReschedule({ calendar, clock }: ClinicDependencies) {
  return defineCapability({
    title: "Reschedule appointment",
    description:
      "Move um agendamento existente se o aviso mínimo e o novo horário forem válidos pela política da clínica.",
    input,
    output,
    access: "authenticated",
    timeoutMs: 20_000,
    annotations: {
      readOnly: false,
      destructive: false,
      idempotent: true,
      openWorld: false,
    },
    async run({ input: request, context }) {
      requirePrincipal(context.principal);
      const current = await calendar.getAppointment(request.appointmentId, {
        signal: context.signal,
      });
      if (current === null || current.status !== "confirmed") {
        throw domainFailure("Appointment not found.", {
          appointmentId: request.appointmentId,
        });
      }

      const now = clock.now();
      if (
        new Date(current.start).getTime() <
        addMinutes(now, clinicPolicy.minNoticeMinutes).getTime()
      ) {
        throw domainFailure(
          "The current appointment is inside the notice window and cannot be moved.",
          { appointmentId: current.id },
        );
      }

      const practitionerId = request.practitionerId ?? current.practitionerId;
      const practitioner = findPractitioner(clinicPolicy, practitionerId);
      if (practitioner === undefined) {
        throw domainFailure("Unknown practitioner.", { practitionerId });
      }

      const start = new Date(request.start);
      const localDate = formatLocalDate(start, clinicPolicy.utcOffset);
      const busy = await calendar.listBusy({
        start: localDateTime(localDate, "00:00", clinicPolicy.utcOffset),
        end: localDateTime(addDays(localDate, 1), "00:00", clinicPolicy.utcOffset),
        practitionerId,
        signal: context.signal,
      });
      const bookable = slotIsBookable({
        policy: clinicPolicy,
        appointmentType: current.appointmentType,
        practitionerId,
        start,
        now,
        busy,
        ignoreAppointmentId: current.id,
      });
      if (!bookable.ok) {
        throw domainFailure(bookable.reason, { start: request.start });
      }

      const updated = await calendar.updateAppointment(
        {
          ...current,
          practitionerId,
          start: toIso(start),
          end: toIso(bookable.end),
          status: "confirmed",
        },
        { signal: context.signal },
      );

      return {
        appointmentId: updated.id,
        status: "confirmed" as const,
        practitionerId: updated.practitionerId,
        practitionerName: practitioner.name,
        patientName: updated.patientName,
        appointmentType: updated.appointmentType,
        start: updated.start,
        end: updated.end,
        previousStart: current.start,
      };
    },
  });
}
