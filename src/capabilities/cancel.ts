import { defineCapability } from "@invokta/core";
import { z } from "zod";

import type { ClinicDependencies } from "../application/ports.js";
import { clinicPolicy } from "../domain/clinic-policy.js";
import { domainFailure, requirePrincipal } from "../domain/errors.js";
import { addMinutes } from "../domain/time.js";
import { appointmentIdSchema } from "./schemas.js";

const input = z.object({
  appointmentId: appointmentIdSchema,
  reason: z.string().trim().min(1).max(200).optional(),
});

const output = z.object({
  appointmentId: z.string(),
  status: z.literal("cancelled"),
  start: z.string(),
  practitionerId: z.string(),
  reason: z.string().optional(),
});

export function createCancel({ calendar, clock }: ClinicDependencies) {
  return defineCapability({
    title: "Cancel appointment",
    description:
      "Cancela um agendamento se o pedido respeitar o aviso mínimo da clínica.",
    input,
    output,
    access: "authenticated",
    timeoutMs: 15_000,
    annotations: {
      readOnly: false,
      destructive: true,
      idempotent: true,
      openWorld: false,
    },
    async run({ input: request, context }) {
      requirePrincipal(context.principal);
      const current = await calendar.getAppointment(request.appointmentId, {
        signal: context.signal,
      });
      if (current === null) {
        throw domainFailure("Appointment not found.", {
          appointmentId: request.appointmentId,
        });
      }
      if (current.status === "cancelled") {
        return {
          appointmentId: current.id,
          status: "cancelled" as const,
          start: current.start,
          practitionerId: current.practitionerId,
          ...(request.reason === undefined ? {} : { reason: request.reason }),
        };
      }

      const now = clock.now();
      if (
        new Date(current.start).getTime() <
        addMinutes(now, clinicPolicy.minNoticeMinutes).getTime()
      ) {
        throw domainFailure(
          "The appointment is inside the notice window and cannot be cancelled.",
          { appointmentId: current.id },
        );
      }

      const updated = await calendar.updateAppointment(
        { ...current, status: "cancelled" },
        { signal: context.signal },
      );

      return {
        appointmentId: updated.id,
        status: "cancelled" as const,
        start: updated.start,
        practitionerId: updated.practitionerId,
        ...(request.reason === undefined ? {} : { reason: request.reason }),
      };
    },
  });
}
