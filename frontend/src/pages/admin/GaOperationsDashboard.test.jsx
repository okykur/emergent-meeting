import { periodRange } from "./GaOperationsDashboard";

describe("GA operations dashboard period ranges", () => {
  const now = new Date(2026, 9, 15, 10, 30, 0);

  test("uses Monday as the start of the current week", () => {
    const range = periodRange("week", "", "", now);
    expect(range.start).toEqual(new Date(2026, 9, 12, 0, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 9, 15, 23, 59, 59, 999));
  });

  test("uses the first day of the month and quarter", () => {
    expect(periodRange("month", "", "", now).start).toEqual(new Date(2026, 9, 1));
    expect(periodRange("quarter", "", "", now).start).toEqual(new Date(2026, 9, 1));
  });

  test("uses inclusive custom dates", () => {
    const range = periodRange("custom", "2026-09-01", "2026-09-30", now);
    expect(range.start).toEqual(new Date(2026, 8, 1, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 8, 30, 23, 59, 59));
  });
});
