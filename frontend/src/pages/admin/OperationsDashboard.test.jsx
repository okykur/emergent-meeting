import { dashboardTabsForRole } from "../../utils/dashboardAccess";

describe("operations dashboard role tabs", () => {
  test("Meeting Admin only receives the meeting dashboard", () => {
    expect(dashboardTabsForRole("meeting_admin")).toEqual(["meeting"]);
  });

  test("Admin Kendaraan only receives the vehicle dashboard", () => {
    expect(dashboardTabsForRole("car_admin")).toEqual(["vehicle"]);
  });

  test.each(["manager", "super_admin"])("%s receives both dashboards", (role) => {
    expect(dashboardTabsForRole(role)).toEqual(["meeting", "vehicle"]);
  });

  test("regular users receive no dashboard tab", () => {
    expect(dashboardTabsForRole("user")).toEqual([]);
  });
});
