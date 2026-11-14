import { describe, expect, it } from "vitest";

import {
  addDaysToIsoDate,
  dayNumberFor,
  effectiveStatus,
  eventDayInTimezone,
  isWithinEventDates,
  nextQuotaReset,
  totalDaysFor,
} from "../src/utils/event-time.js";

const NEW_YORK = "America/New_York";
const MEXICO = "America/Mexico_City";

describe("días del evento en su zona horaria", () => {
  it("usa la zona del evento y no la del servidor", () => {
    const instant = new Date("2026-11-16T03:30:00.000Z");

    expect(eventDayInTimezone(MEXICO, instant)).toBe("2026-11-15");
    expect(eventDayInTimezone("Europe/Madrid", instant)).toBe("2026-11-16");
    expect(eventDayInTimezone("Pacific/Kiritimati", instant)).toBe("2026-11-16");
  });

  it("calcula el número de día y el total de días", () => {
    expect(dayNumberFor("2026-11-14", "2026-11-14")).toBe(1);
    expect(dayNumberFor("2026-11-14", "2026-11-17")).toBe(4);
    expect(totalDaysFor("2026-11-14", "2026-11-17")).toBe(4);
    expect(totalDaysFor("2026-11-14", "2026-11-14")).toBe(1);
  });

  it("suma días sin verse afectado por el horario de verano", () => {
    expect(addDaysToIsoDate("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysToIsoDate("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysToIsoDate("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("deriva el estado efectivo de las fechas", () => {
    const base = {
      startDate: "2026-11-14",
      endDate: "2026-11-17",
      timezone: MEXICO,
      status: "scheduled" as const,
    };

    expect(effectiveStatus(base, new Date("2026-11-13T18:00:00.000Z"))).toBe("scheduled");
    expect(effectiveStatus(base, new Date("2026-11-15T18:00:00.000Z"))).toBe("active");
    expect(effectiveStatus(base, new Date("2026-11-18T18:00:00.000Z"))).toBe("out_of_dates");
    expect(
      effectiveStatus({ ...base, status: "cancelled" }, new Date("2026-11-15T18:00:00.000Z")),
    ).toBe("cancelled");
    expect(
      effectiveStatus({ ...base, status: "finished" }, new Date("2026-11-15T18:00:00.000Z")),
    ).toBe("finished");
  });

  it("comprueba el rango de fechas con cadenas ISO", () => {
    const event = {
      startDate: "2026-11-14",
      endDate: "2026-11-17",
      timezone: MEXICO,
      status: "active" as const,
    };

    expect(isWithinEventDates(event, "2026-11-13")).toBe(false);
    expect(isWithinEventDates(event, "2026-11-14")).toBe(true);
    expect(isWithinEventDates(event, "2026-11-17")).toBe(true);
    expect(isWithinEventDates(event, "2026-11-18")).toBe(false);
  });
});

describe("reinicio de cuota con horario de verano", () => {
  it("usa medianoche local en invierno (EST, UTC-5)", () => {
    const reset = nextQuotaReset(NEW_YORK, new Date("2026-03-07T12:00:00.000Z"));
    expect(reset.toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });

  it("usa medianoche local en verano (EDT, UTC-4)", () => {
    const reset = nextQuotaReset(NEW_YORK, new Date("2026-03-08T12:00:00.000Z"));
    expect(reset.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("vuelve a UTC-5 al terminar el horario de verano", () => {
    const reset = nextQuotaReset(NEW_YORK, new Date("2026-11-01T12:00:00.000Z"));
    expect(reset.toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("respeta zonas sin horario de verano", () => {
    const reset = nextQuotaReset(MEXICO, new Date("2026-03-08T12:00:00.000Z"));
    expect(reset.toISOString()).toBe("2026-03-09T06:00:00.000Z");
  });
});
