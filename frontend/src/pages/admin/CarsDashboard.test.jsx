import { groupedVehicleStatus, vehicleAssignmentKey, vehiclePeriodRange } from "./CarsDashboard";

describe("vehicle operations dashboard analytics", () => {
  const now = new Date(2026, 9, 15, 10, 30, 0);

  test("builds week, quarter, and custom date ranges", () => {
    expect(vehiclePeriodRange("week", "", "", now).start).toEqual(new Date(2026, 9, 12, 0, 0, 0, 0));
    expect(vehiclePeriodRange("quarter", "", "", now).start).toEqual(new Date(2026, 9, 1));
    expect(vehiclePeriodRange("custom", "2026-09-01", "2026-09-30", now).end).toEqual(new Date(2026, 8, 30, 23, 59, 59));
  });

  test("groups active assignment statuses as approved", () => {
    expect(groupedVehicleStatus("approved")).toBe("approved");
    expect(groupedVehicleStatus("assigned")).toBe("approved");
    expect(groupedVehicleStatus("in_use")).toBe("approved");
    expect(groupedVehicleStatus("rejected")).toBe("rejected");
  });

  test("categorizes driver and vehicle assignments", () => {
    expect(vehicleAssignmentKey({ vehicle_id: "v1", driver_id: "d1", with_driver: true })).toBe("vehicle_driver");
    expect(vehicleAssignmentKey({ vehicle_id: "v1", driver_id: null, with_driver: false })).toBe("vehicle_only");
    expect(vehicleAssignmentKey({ vehicle_id: null, driver_id: "d1", with_driver: true })).toBe("driver_only");
    expect(vehicleAssignmentKey({ vehicle_id: null, driver_id: null, with_driver: true })).toBe("unassigned");
  });
});
