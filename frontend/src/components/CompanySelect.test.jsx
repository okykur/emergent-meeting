import { companyDisplayName } from "./CompanySelect";

test("company search label excludes the PT prefix", () => {
  expect(companyDisplayName("PT Aroma Tobacco International")).toBe("Aroma Tobacco International");
  expect(companyDisplayName("PT. Dinamika Niaga Nusantara")).toBe("Dinamika Niaga Nusantara");
  expect(companyDisplayName("GPT")).toBe("GPT");
});
