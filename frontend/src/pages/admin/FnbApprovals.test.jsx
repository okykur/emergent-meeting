import { isActiveManagerApproval } from "../../utils/managerApproval";

const base = {
  status: "pending",
  meeting_admin_approval_status: "approved",
  approval_require_manager_user: true,
  approval_require_manager_ga: true,
  manager_user_approval_status: "approved",
  manager_ga_approval_status: "pending",
  fnb_status: "pending",
  food_beverages: "Makan siang",
  start_time: "09:00",
  end_time: "14:00",
};

test("shows a booking waiting for Manager GA after Manager User approval", () => {
  expect(isActiveManagerApproval(base)).toBe(true);
});

test("hides a booking while Manager User approval is pending", () => {
  expect(isActiveManagerApproval({ ...base, manager_user_approval_status: "pending" })).toBe(false);
});

test("shows Manager GA-only approval after Meeting Admin", () => {
  expect(isActiveManagerApproval({ ...base, approval_require_manager_user: false, manager_user_approval_status: "not_required" })).toBe(true);
});

test("hides completed, cancelled, and invalid-duration requests", () => {
  expect(isActiveManagerApproval({ ...base, status: "completed" })).toBe(false);
  expect(isActiveManagerApproval({ ...base, status: "cancelled" })).toBe(false);
  expect(isActiveManagerApproval({ ...base, end_time: "12:00" })).toBe(false);
});
