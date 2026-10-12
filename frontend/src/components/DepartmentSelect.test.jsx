import { filterDepartmentOptions } from "./DepartmentSelect";

const options = [
  { code_dept: "DEPT060", dept_name: "OPERATIONAL" },
  { code_dept: "DEPT061", dept_name: "OPERATIONAL SUPPORT" },
  { code_dept: "DEPT025", dept_name: "APPLICATION DEVELOPMENT (DOWNSTREAM)" },
  { code_dept: "DEPT029", dept_name: "IT SECURITY & GOVERNANCE" },
];

test("department search prioritizes matches from the first one to five letters", () => {
  expect(filterDepartmentOptions(options, "o").map((item) => item.code_dept)).toEqual(["DEPT060", "DEPT061"]);
  expect(filterDepartmentOptions(options, "opera").map((item) => item.code_dept)).toEqual(["DEPT060", "DEPT061"]);
  expect(filterDepartmentOptions(options, "appli").map((item) => item.code_dept)).toEqual(["DEPT025"]);
});

test("department search also supports word prefixes and department codes", () => {
  expect(filterDepartmentOptions(options, "security").map((item) => item.code_dept)).toEqual(["DEPT029"]);
  expect(filterDepartmentOptions(options, "dept025").map((item) => item.code_dept)).toEqual(["DEPT025"]);
});
