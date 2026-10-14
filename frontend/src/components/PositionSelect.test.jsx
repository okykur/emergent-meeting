import { filterPositionOptions } from "./PositionSelect";

const options = [
  { code_position: "JOB001", position_name: "MECHANICAL TECHNICIAN" },
  { code_position: "JOB002", position_name: "MAINTENANCE SUPERVISOR" },
  { code_position: "JOB014", position_name: "IT NETWORK STAFF" },
  { code_position: "JOB318", position_name: "STRATEGIC FINANCE MANAGER" },
];

test("position search prioritizes matches from the first one to five letters", () => {
  expect(filterPositionOptions(options, "m").map((item) => item.code_position)).toEqual(["JOB002", "JOB001"]);
  expect(filterPositionOptions(options, "mecha").map((item) => item.code_position)).toEqual(["JOB001"]);
  expect(filterPositionOptions(options, "maint").map((item) => item.code_position)).toEqual(["JOB002"]);
});

test("position search supports longer text and position codes", () => {
  expect(filterPositionOptions(options, "finance").map((item) => item.code_position)).toEqual(["JOB318"]);
  expect(filterPositionOptions(options, "job014").map((item) => item.code_position)).toEqual(["JOB014"]);
});
