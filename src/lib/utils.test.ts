import { parseSRTTime } from "./utils";

describe("parseSRTTime", () => {
  test("parses basic time string correctly", () => {
    expect(parseSRTTime("00:00:01,000")).toBe(1);
  });

  test("parses time with minutes and milliseconds", () => {
    expect(parseSRTTime("00:01:02,500")).toBe(62.5);
  });

  test("parses time with hours", () => {
    expect(parseSRTTime("01:00:00,000")).toBe(3600);
  });
});
