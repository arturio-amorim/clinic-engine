import { defineCapability } from "@invokta/core";
import { z } from "zod";

import type { ClinicDependencies } from "../application/ports.js";
import { clinicPolicy } from "../domain/clinic-policy.js";
import { listValidSlots } from "../domain/slot-finder.js";
import { addDays, formatLocalDate, localDateTime } from "../domain/time.js";
import { appointmentTypeSchema, localDateSchema } from "./schemas.js";

const input = z.object({
  appointmentType: appointmentTypeSchema,
  date: localDateSchema.optional(),
  practitionerId: z.string().trim().min(1).optional(),
});

const output = z.object({
  clinic: z.string(),
  timeZone: z.string(),
  slots: z.array(
    z.object({
      practitionerId: z.string(),
      practitionerName: z.string(),
      appointmentType: appointmentTypeSchema,
      start: z.string(),
      end: z.string(),
      durationMinutes: z.number().int().positive(),
    }),
  ),
});

export function createListValidSlots({ calendar, clock }: ClinicDependencies) {
  return defineCapability({
    title: "List valid appointment slots",
    description:
      "Lista horários que a Clínica Horizonte permite oferecer, aplicando expediente, buffer, aviso mínimo e agenda ocupada.",
    input,
    output,
    access: "public",
    timeoutMs: 15_000,
    annotations: {
      readOnly: true,
      destructive: false,
      idempotent: true,
      openWorld: false,
    },
    async run({ input: request, context }) {
      const now = clock.now();
      const fromDate =
        request.date ?? formatLocalDate(now, clinicPolicy.utcOffset);
      const untilDate = request.date ?? addDays(fromDate, clinicPolicy.defaultLookaheadDays);
      const busy = await calendar.listBusy({
        start: localDateTime(fromDate, "00:00", clinicPolicy.utcOffset),
        end: localDateTime(untilDate, "23:59", clinicPolicy.utcOffset),
        ...(request.practitionerId === undefined
          ? {}
          : { practitionerId: request.practitionerId }),
        signal: context.signal,
      });

      const slots = listValidSlots({
        policy: clinicPolicy,
        appointmentType: request.appointmentType,
        ...(request.practitionerId === undefined
          ? {}
          : { practitionerId: request.practitionerId }),
        ...(request.date === undefined ? {} : { date: request.date }),
        now,
        busy,
      }).map((slot) => ({
        practitionerId: slot.practitionerId,
        practitionerName: slot.practitionerName,
        appointmentType: slot.appointmentType,
        start: slot.start,
        end: slot.end,
        durationMinutes: slot.durationMinutes,
      }));

      return {
        clinic: clinicPolicy.name,
        timeZone: clinicPolicy.timeZone,
        slots,
      };
    },
  });
}
