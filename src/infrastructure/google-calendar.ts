import { defineConnector, EngineError } from "@invokta/core";
import { z } from "zod";

import type { Appointment, AppointmentType } from "../domain/types.js";
import type { CalendarPort } from "../application/ports.js";

const privateKeys = {
  practitionerId: "practitionerId",
  appointmentType: "appointmentType",
  patientName: "patientName",
  patientPhone: "patientPhone",
} as const;

interface GoogleEvent {
  readonly id?: string;
  readonly status?: string;
  readonly start?: { readonly dateTime?: string };
  readonly end?: { readonly dateTime?: string };
  readonly extendedProperties?: {
    readonly private?: Readonly<Record<string, string>>;
  };
}

export const googleCalendarConnector = defineConnector({
  name: "google-calendar",
  config: z.object({
    calendarId: z.string().trim().min(1),
    accessToken: z.string().trim().min(1),
  }),
  create(config, dependencies: { readonly fetchImpl?: typeof fetch }) {
    const fetchImpl = dependencies.fetchImpl ?? fetch;
    const calendar: CalendarPort = {
      async listBusy({ start, end, practitionerId, signal }) {
        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`,
        );
        url.searchParams.set("timeMin", start.toISOString());
        url.searchParams.set("timeMax", end.toISOString());
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("maxResults", "250");
        const payload = await googleJson<{ readonly items?: GoogleEvent[] }>(
          fetchImpl,
          url,
          { method: "GET", token: config.accessToken, signal },
        );
        return (payload.items ?? [])
          .map(fromGoogleEvent)
          .filter((appointment): appointment is Appointment => {
            if (appointment === null) return false;
            if (
              practitionerId !== undefined &&
              appointment.practitionerId !== practitionerId
            ) {
              return false;
            }
            return appointment.status === "confirmed";
          });
      },

      async getAppointment(appointmentId, { signal }) {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(appointmentId)}`;
        try {
          const payload = await googleJson<GoogleEvent>(fetchImpl, url, {
            method: "GET",
            token: config.accessToken,
            signal,
          });
          return fromGoogleEvent(payload);
        } catch (error) {
          if (error instanceof EngineError) {
            const details = error.publicDetails as
              | { readonly status?: number }
              | undefined;
            if (details?.status === 404) return null;
          }
          throw error;
        }
      },

      async createAppointment(appointment, { signal }) {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`;
        const payload = await googleJson<GoogleEvent>(fetchImpl, url, {
          method: "POST",
          token: config.accessToken,
          signal,
          body: toGoogleEvent(appointment),
        });
        const created = fromGoogleEvent(payload);
        if (created === null) {
          throw new EngineError({
            code: "EXECUTION_FAILED",
            message: "Google Calendar returned an event the clinic cannot use.",
          });
        }
        return created;
      },

      async updateAppointment(appointment, { signal }) {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(appointment.id)}`;
        const payload = await googleJson<GoogleEvent>(fetchImpl, url, {
          method: "PATCH",
          token: config.accessToken,
          signal,
          body: toGoogleEvent(appointment),
        });
        const updated = fromGoogleEvent(payload);
        if (updated === null) {
          throw new EngineError({
            code: "EXECUTION_FAILED",
            message: "Google Calendar returned an event the clinic cannot use.",
          });
        }
        return updated;
      },
    };

    return { ports: { calendar } };
  },
});

async function googleJson<T>(
  fetchImpl: typeof fetch,
  url: string | URL,
  options: {
    readonly method: string;
    readonly token: string;
    readonly signal: AbortSignal;
    readonly body?: unknown;
  },
): Promise<T> {
  options.signal.throwIfAborted();
  const response = await fetchImpl(url, {
    method: options.method,
    signal: options.signal,
    headers: {
      authorization: `Bearer ${options.token}`,
      accept: "application/json",
      ...(options.body === undefined
        ? {}
        : { "content-type": "application/json" }),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  if (!response.ok) {
    throw new EngineError({
      code: "EXECUTION_FAILED",
      message: "The calendar provider rejected the request.",
      publicDetails: { status: response.status },
    });
  }
  return (await response.json()) as T;
}

function toGoogleEvent(appointment: Appointment): Record<string, unknown> {
  return {
    summary: `${appointment.appointmentType} · ${appointment.patientName}`,
    start: { dateTime: appointment.start, timeZone: "America/Sao_Paulo" },
    end: { dateTime: appointment.end, timeZone: "America/Sao_Paulo" },
    status: appointment.status === "cancelled" ? "cancelled" : "confirmed",
    extendedProperties: {
      private: {
        [privateKeys.practitionerId]: appointment.practitionerId,
        [privateKeys.appointmentType]: appointment.appointmentType,
        [privateKeys.patientName]: appointment.patientName,
        ...(appointment.patientPhone === undefined
          ? {}
          : { [privateKeys.patientPhone]: appointment.patientPhone }),
      },
    },
  };
}

function fromGoogleEvent(event: GoogleEvent): Appointment | null {
  const privateProps = event.extendedProperties?.private ?? {};
  const practitionerId = privateProps[privateKeys.practitionerId];
  const appointmentType = privateProps[privateKeys.appointmentType] as
    | AppointmentType
    | undefined;
  const patientName = privateProps[privateKeys.patientName];
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;
  const id = event.id;
  if (
    practitionerId === undefined ||
    appointmentType === undefined ||
    patientName === undefined ||
    start === undefined ||
    end === undefined ||
    id === undefined
  ) {
    return null;
  }
  const phone = privateProps[privateKeys.patientPhone];
  return {
    id,
    practitionerId,
    patientName,
    ...(phone === undefined ? {} : { patientPhone: phone }),
    appointmentType,
    start,
    end,
    status: event.status === "cancelled" ? "cancelled" : "confirmed",
  };
}
