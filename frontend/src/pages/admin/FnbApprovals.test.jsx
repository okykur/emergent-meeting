import { isActiveManagerApproval } from "../../utils/managerApproval";

const base = {
  status: "pending",
  supervisor_approval_status: "approved",
  fnb_status: "pending",
  food_beverages: "",
  start_time: "09:00",
  end_time: "14:00",
};

test("shows a pending room request after supervisor approval", () => {
  expect(isActiveManagerApproval(base)).toBe(true);
});

test("hides requests that still wait for supervisor approval", () => {
  expect(isActiveManagerApproval({ ...base, supervisor_approval_status: "pending" })).toBe(false);
});

test("shows a valid final F&B approval", () => {
  expect(isActiveManagerApproval({ ...base, status: "confirmed", food_beverages: "Makan siang" })).toBe(true);
});

test("hides completed, rejected, and invalid-duration requests", () => {
  expect(isActiveManagerApproval({ ...base, status: "completed" })).toBe(false);
  expect(isActiveManagerApproval({ ...base, status: "cancelled" })).toBe(false);
  expect(isActiveManagerApproval({ ...base, status: "confirmed", food_beverages: "Makan siang", end_time: "12:00" })).toBe(false);
});
