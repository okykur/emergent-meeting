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
  status: "pending", supervisor_approval_status: "approved",
};

let container, root, props;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  props = { booking, onClose: jest.fn(), onUpdateMeeting: jest.fn().mockResolvedValue(true), onUpdateFnb: jest.fn().mockResolvedValue(true) };
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = () => act(() => root.render(<ManagerMeetingDetail {...props} />));
const button = (label) => [...container.querySelectorAll("button")].find((node) => node.textContent === label);
const click = async (label) => act(async () => { button(label).click(); });

test("Setujui opens confirmation without saving; Batal returns to detail", async () => {
  render();
  await click("Setujui");
  expect(container.textContent).toContain("Setujui pengajuan BKG-MR-035?");
  expect(props.onUpdateMeeting).not.toHaveBeenCalled();
  await click("Batal");
  expect(container.querySelector('[data-testid="manager-meeting-detail"]')).not.toBeNull();
  expect(props.onUpdateMeeting).not.toHaveBeenCalled();
});

test("confirmation approves only the current room stage", async () => {
  render();
  await click("Setujui");
  await click("Ya, Setujui");
  expect(props.onUpdateMeeting).toHaveBeenCalledWith(booking.id, "confirmed");
  expect(props.onUpdateFnb).not.toHaveBeenCalled();
});

test("confirmation approves F&B after room approval", async () => {
  props.booking = { ...booking, status: "confirmed", food_beverages: "Makan siang", fnb_status: "pending" };
  props.initialConfirm = true;
  render();
  await click("Ya, Setujui");
  expect(props.onUpdateFnb).toHaveBeenCalledWith(booking.id, "approved");
  expect(props.onUpdateMeeting).not.toHaveBeenCalled();
});

test("failed approval stays open and can be retried", async () => {
  props.onUpdateMeeting.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  props.initialConfirm = true;
  render();
  await click("Ya, Setujui");
  expect(container.querySelector('[role="alert"]').textContent).toContain("belum tersimpan");
  expect(props.onClose).not.toHaveBeenCalled();
  await click("Ya, Setujui");
  expect(props.onUpdateMeeting).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});

test("repeated clicks send one request and lock buttons while saving", async () => {
  let resolve;
  props.onUpdateMeeting.mockImplementation(() => new Promise((done) => { resolve = done; }));
  props.initialConfirm = true;
  render();
  act(() => { const confirm = button("Ya, Setujui"); confirm.click(); confirm.click(); });
  expect(props.onUpdateMeeting).toHaveBeenCalledTimes(1);
  expect(button("Batal").disabled).toBe(true);
  expect(button("Menyimpan…").disabled).toBe(true);
  await act(async () => resolve(true));
});

test("ineligible bookings cannot submit from confirmation", async () => {
  props.booking = { ...booking, supervisor_approval_status: "pending" };
  props.initialConfirm = true;
  render();
  expect(button("Ya, Setujui").disabled).toBe(true);
  await click("Ya, Setujui");
  expect(props.onUpdateMeeting).not.toHaveBeenCalled();
});

test("Tolak opens required reason form and Batal returns to detail", async () => {
  render();
  await click("Tolak");
  expect(container.textContent).toContain("Tolak pengajuan BKG-MR-035?");
  expect(button("Kirim Penolakan").disabled).toBe(true);
  expect(props.onUpdateMeeting).not.toHaveBeenCalled();
  await click("Batal");
  expect(container.querySelector('[data-testid="manager-meeting-detail"]')).not.toBeNull();
});

test("room rejection submits the trimmed reason", async () => {
  props.initialReject = true;
  render();
  const textarea = container.querySelector("textarea");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, "  Ruang perlu diganti  ");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Kirim Penolakan");
  expect(props.onUpdateMeeting).toHaveBeenCalledWith(booking.id, "cancelled", "Ruang perlu diganti");
});

test("F&B rejection submits its reason to the F&B endpoint callback", async () => {
  props.booking = { ...booking, status: "confirmed", food_beverages: "Makan siang", fnb_status: "pending" };
  props.initialReject = true;
  render();
  const textarea = container.querySelector("textarea");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(textarea, "Jumlah konsumsi tidak sesuai");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Kirim Penolakan");
  expect(props.onUpdateFnb).toHaveBeenCalledWith(booking.id, "rejected", "Jumlah konsumsi tidak sesuai");
  expect(props.onUpdateMeeting).not.toHaveBeenCalled();
});
