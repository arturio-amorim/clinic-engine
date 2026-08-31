import { z } from "zod";

import { appointmentTypes } from "../domain/types.js";

export const appointmentTypeSchema = z.enum(appointmentTypes);

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const isoDateTimeSchema = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: "Use an ISO-8601 datetime.",
  });

export const patientNameSchema = z.string().trim().min(1).max(80);

export const appointmentIdSchema = z.string().trim().min(1).max(128);
