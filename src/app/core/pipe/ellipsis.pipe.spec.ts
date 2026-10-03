import { EllipsisPipe } from "./ellipsis.pipe";

describe("EllipsisPipe", () => {
  const pipe = new EllipsisPipe();

  it("keeps text that fits the limit", () => {
    expect(pipe.transform("short text", 20)).toBe("short text");
    expect(pipe.transform("exactly10!", 10)).toBe("exactly10!");
  });

  it("truncates longer text and appends an ellipsis", () => {
    expect(pipe.transform("A longer description", 8)).toBe("A longer...");
  });

  it("defaults to 60 characters", () => {
    const text = "x".repeat(61);
    expect(pipe.transform(text)).toBe("x".repeat(60) + "...");
  });
});
