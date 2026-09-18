import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ManagerMeetingDetail from "./ManagerMeetingDetail";

jest.mock("./ui/dialog", () => ({
  Dialog: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children, onEscapeKeyDown, onPointerDownOutside, ...props }) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
  DialogDescription: ({ children, ...props }) => <p {...props}>{children}</p>,
}));

const booking = {
  id: "BKG-MR-035", user_name: "Test User", date: "2026-09-16",
  start_time: "09:00", end_time: "14:00", participants: 12,
  status: "pending", food_beverages: "Makan siang", fnb_status: "pending",
  meeting_admin_approval_status: "approved",
  approval_require_manager_user: true, manager_user_approval_status: "approved",
  approval_require_manager_ga: true, manager_ga_approval_status: "pending",
};

let container, root, props;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  props = { booking, onClose: jest.fn(), onUpdateFnb: jest.fn().mockResolvedValue(true) };
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = () => act(() => root.render(<ManagerMeetingDetail {...props} />));
const button = (label) => [...container.querySelectorAll("button")].find((node) => node.textContent === label);
const click = async (label) => act(async () => { button(label).click(); });

test("Setujui opens confirmation without saving", async () => {
  render();
  await click("Setujui");
  expect(container.textContent).toContain("Setujui pengajuan BKG-MR-035?");
  expect(props.onUpdateFnb).not.toHaveBeenCalled();
});

test("confirmation approves Manager GA stage", async () => {
  props.initialConfirm = true;
  render();
  await click("Ya, Setujui");
  expect(props.onUpdateFnb).toHaveBeenCalledWith(booking.id, "approved");
});

test("ineligible bookings cannot submit from confirmation", () => {
  props.booking = { ...booking, manager_user_approval_status: "pending" };
  props.initialConfirm = true;
  render();
  expect(button("Ya, Setujui").disabled).toBe(true);
});

test("Manager GA rejection submits the trimmed reason", async () => {
  props.initialReject = true;
  render();
  const textarea = container.querySelector("textarea");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, "  Jumlah konsumsi tidak sesuai  ");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Kirim Penolakan");
  expect(props.onUpdateFnb).toHaveBeenCalledWith(booking.id, "rejected", "Jumlah konsumsi tidak sesuai");
});
