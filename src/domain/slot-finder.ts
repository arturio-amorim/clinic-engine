import type { Appointment, ClinicPolicy, Slot } from "./types.js";
import {
  durationFor,
  findPractitioner,
  practitionersForType,
} from "./clinic-policy.js";
import {
  addDays,
  addMinutes,
  formatLocalDate,
  localDateTime,
  overlapsWithBuffer,
  toIso,
  weekdayInOffset,
} from "./time.js";

export function listCandidateDates(
  policy: ClinicPolicy,
  now: Date,
  date?: string,
): readonly string[] {
  if (date !== undefined) return [date];
  const start = formatLocalDate(now, policy.utcOffset);
  const dates: string[] = [];
  for (let offset = 0; offset < policy.defaultLookaheadDays; offset += 1) {
    dates.push(addDays(start, offset));
  }
  return dates;
}

export function listValidSlots(args: {
  readonly policy: ClinicPolicy;
  readonly appointmentType: Slot["appointmentType"];
  readonly practitionerId?: string;
  readonly date?: string;
  readonly now: Date;
  readonly busy: readonly Appointment[];
}): readonly Slot[] {
  const practitioners = practitionersForType(
    args.policy,
    args.appointmentType,
    args.practitionerId,
  );
  if (practitioners.length === 0) return [];

  const durationMinutes = durationFor(args.policy, args.appointmentType);
  const dates = listCandidateDates(args.policy, args.now, args.date);
  const slots: Slot[] = [];

  for (const localDate of dates) {
    for (const practitioner of practitioners) {
      const daySlots = slotsForDay({
        policy: args.policy,
        localDate,
        practitioner,
        appointmentType: args.appointmentType,
        durationMinutes,
        now: args.now,
        busy: args.busy,
      });
      for (const slot of daySlots) {
        slots.push(slot);
        if (slots.length >= args.policy.maxListedSlots) return slots;
      }
    }
  }

  return slots;
}

export function slotIsBookable(args: {
  readonly policy: ClinicPolicy;
  readonly appointmentType: Slot["appointmentType"];
  readonly practitionerId: string;
  readonly start: Date;
  readonly now: Date;
  readonly busy: readonly Appointment[];
  readonly ignoreAppointmentId?: string;
}): { readonly ok: true; readonly end: Date } | { readonly ok: false; readonly reason: string } {
  const practitioner = findPractitioner(args.policy, args.practitionerId);
  if (practitioner === undefined) {
    return { ok: false, reason: "Unknown practitioner." };
  }
  if (!practitioner.appointmentTypes.includes(args.appointmentType)) {
    return {
      ok: false,
      reason: "This practitioner does not offer that appointment type.",
    };
  }

  const durationMinutes = durationFor(args.policy, args.appointmentType);
  const end = addMinutes(args.start, durationMinutes);
  const localDate = formatLocalDate(args.start, args.policy.utcOffset);
  const hours = args.policy.hours.find(
    (entry) => entry.weekday === weekdayInOffset(args.start, args.policy.utcOffset),
  );
  if (hours === undefined) {
    return { ok: false, reason: "The clinic is closed on that day." };
  }

  const open = localDateTime(localDate, hours.open, args.policy.utcOffset);
  const close = localDateTime(localDate, hours.close, args.policy.utcOffset);
  if (args.start.getTime() < open.getTime() || end.getTime() > close.getTime()) {
    return { ok: false, reason: "The slot is outside clinic hours." };
  }
  if (args.start.getTime() < addMinutes(args.now, args.policy.minNoticeMinutes).getTime()) {
    return {
      ok: false,
      reason: "The slot does not meet the minimum notice policy.",
    };
  }
  if (
    conflicts(
      args.policy,
      args.busy,
      args.practitionerId,
      args.start,
      end,
      args.ignoreAppointmentId,
    )
  ) {
    return { ok: false, reason: "The slot is no longer available." };
  }
  return { ok: true, end };
}

function slotsForDay(args: {
  readonly policy: ClinicPolicy;
  readonly localDate: string;
  readonly practitioner: ClinicPolicy["practitioners"][number];
  readonly appointmentType: Slot["appointmentType"];
  readonly durationMinutes: number;
  readonly now: Date;
  readonly busy: readonly Appointment[];
}): readonly Slot[] {
  const weekday = weekdayInOffset(
    localDateTime(args.localDate, "12:00", args.policy.utcOffset),
    args.policy.utcOffset,
  );
  const hours = args.policy.hours.find((entry) => entry.weekday === weekday);
  if (hours === undefined) return [];

  const open = localDateTime(args.localDate, hours.open, args.policy.utcOffset);
  const close = localDateTime(args.localDate, hours.close, args.policy.utcOffset);
  const earliest = addMinutes(args.now, args.policy.minNoticeMinutes);
  const slots: Slot[] = [];

  for (
    let start = open;
    addMinutes(start, args.durationMinutes).getTime() <= close.getTime();
    start = addMinutes(start, args.policy.slotIntervalMinutes)
  ) {
    const end = addMinutes(start, args.durationMinutes);
    if (start.getTime() < earliest.getTime()) continue;
    if (conflicts(args.policy, args.busy, args.practitioner.id, start, end)) {
      continue;
    }
    slots.push({
      practitionerId: args.practitioner.id,
      practitionerName: args.practitioner.name,
      appointmentType: args.appointmentType,
      start: toIso(start),
      end: toIso(end),
      durationMinutes: args.durationMinutes,
    });
  }

  return slots;
}

function conflicts(
  policy: ClinicPolicy,
  busy: readonly Appointment[],
  practitionerId: string,
  start: Date,
  end: Date,
  ignoreAppointmentId?: string,
): boolean {
  return busy.some((appointment) => {
    if (appointment.status !== "confirmed") return false;
    if (appointment.practitionerId !== practitionerId) return false;
    if (ignoreAppointmentId !== undefined && appointment.id === ignoreAppointmentId) {
      return false;
    }
    return overlapsWithBuffer(
      start,
      end,
      new Date(appointment.start),
      new Date(appointment.end),
      policy.bufferMinutes,
    );
  });
}
