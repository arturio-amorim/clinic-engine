import { describe, expect, it } from "vitest";

import { createClinicEngine, localPrincipal } from "../src/engine.js";
import { createInMemoryCalendar } from "../src/infrastructure/in-memory-calendar.js";
import type { Appointment } from "../src/domain/types.js";

const morningClock = { now: () => new Date("2026-09-07T07:00:00-03:00") };

const seed: readonly Appointment[] = [
  {
    id: "apt_seed_ana_0900",
    practitionerId: "dra-ana-souza",
    patientName: "Marina Costa",
    appointmentType: "consulta-geral",
    start: "2026-09-07T12:00:00.000Z",
    end: "2026-09-07T12:30:00.000Z",
    status: "confirmed",
  },
];

function engineWithSeed() {
  return createClinicEngine({
    calendar: createInMemoryCalendar(seed),
    clock: morningClock,
    createId: () => "apt_test_1",
  });
}

describe("clinic engine", () => {
  it("lists only clinic-approved slots and hides a busy morning appointment", async () => {
    const engine = engineWithSeed();
    const result = await engine.invoke(
      "appointments.list-valid-slots",
      { appointmentType: "consulta-geral", date: "2026-09-07", practitionerId: "dra-ana-souza" },
      { principal: null },
    );

    expect(result.clinic).toBe("Clínica Horizonte");
    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.slots.some((slot) => slot.start === "2026-09-07T12:00:00.000Z")).toBe(
      false,
    );
    expect(result.slots[0]).toMatchObject({
      practitionerId: "dra-ana-souza",
      appointmentType: "consulta-geral",
      durationMinutes: 30,
    });
  });

  it("rejects an empty appointment type", async () => {
    const engine = engineWithSeed();
    await expect(
      engine.invoke("appointments.list-valid-slots", {
        appointmentType: "cirurgia",
      } as never, { principal: null }),
    ).rejects.toMatchObject({ code: "INPUT_INVALID" });
  });

  it("refuses to schedule without a principal", async () => {
    const engine = engineWithSeed();
    await expect(
      engine.invoke(
        "appointments.schedule",
        {
          patientName: "Ada Lovelace",
          appointmentType: "consulta-geral",
          practitionerId: "dra-ana-souza",
          start: "2026-09-07T14:00:00-03:00",
        },
        { principal: null },
      ),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("schedules a revalidated afternoon slot", async () => {
    const engine = engineWithSeed();
    const booked = await engine.invoke(
      "appointments.schedule",
      {
        patientName: "Ada Lovelace",
        appointmentType: "consulta-geral",
        practitionerId: "dra-ana-souza",
        start: "2026-09-07T14:00:00-03:00",
      },
      { principal: localPrincipal },
    );

    expect(booked).toMatchObject({
      appointmentId: "apt_test_1",
      status: "confirmed",
      practitionerName: "Dra. Ana Souza",
      patientName: "Ada Lovelace",
      start: "2026-09-07T17:00:00.000Z",
      end: "2026-09-07T17:30:00.000Z",
    });
  });

  it("rejects a stale or occupied slot", async () => {
    const engine = engineWithSeed();
    await expect(
      engine.invoke(
        "appointments.schedule",
        {
          patientName: "Ada Lovelace",
          appointmentType: "consulta-geral",
          practitionerId: "dra-ana-souza",
          start: "2026-09-07T09:00:00-03:00",
        },
        { principal: localPrincipal },
      ),
    ).rejects.toMatchObject({ code: "EXECUTION_FAILED" });
  });

  it("reschedules when the replacement slot is valid", async () => {
    const engine = engineWithSeed();
    await engine.invoke(
      "appointments.schedule",
      {
        patientName: "Ada Lovelace",
        appointmentType: "consulta-geral",
        practitionerId: "dra-ana-souza",
        start: "2026-09-07T14:00:00-03:00",
      },
      { principal: localPrincipal },
    );

    const moved = await engine.invoke(
      "appointments.reschedule",
      {
        appointmentId: "apt_test_1",
        start: "2026-09-07T15:00:00-03:00",
      },
      { principal: localPrincipal },
    );

    expect(moved).toMatchObject({
      appointmentId: "apt_test_1",
      start: "2026-09-07T18:00:00.000Z",
      previousStart: "2026-09-07T17:00:00.000Z",
    });
  });

  it("cancels with enough notice", async () => {
    const engine = engineWithSeed();
    await engine.invoke(
      "appointments.schedule",
      {
        patientName: "Ada Lovelace",
        appointmentType: "consulta-geral",
        practitionerId: "dra-ana-souza",
        start: "2026-09-07T14:00:00-03:00",
      },
      { principal: localPrincipal },
    );

    await expect(
      engine.invoke(
        "appointments.cancel",
        { appointmentId: "apt_test_1", reason: "paciente desmarcou" },
        { principal: localPrincipal },
      ),
    ).resolves.toMatchObject({
      appointmentId: "apt_test_1",
      status: "cancelled",
      reason: "paciente desmarcou",
    });
  });

  it("refuses a Sunday booking", async () => {
    const engine = engineWithSeed();
    await expect(
      engine.invoke(
        "appointments.schedule",
        {
          patientName: "Ada Lovelace",
          appointmentType: "consulta-geral",
          practitionerId: "dra-ana-souza",
          start: "2026-09-06T10:00:00-03:00",
        },
        { principal: localPrincipal },
      ),
    ).rejects.toMatchObject({ code: "EXECUTION_FAILED" });
  });
});
