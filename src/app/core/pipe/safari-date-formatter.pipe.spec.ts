import { SafariDateFormatterPipe } from "./safari-date-formatter.pipe";

describe("SafariDateFormatterPipe", () => {
  const pipe = new SafariDateFormatterPipe();

  it("replaces every dash with a slash", () => {
    expect(pipe.transform("05-01-2020")).toBe("05/01/2020");
  });

  it("passes empty values through", () => {
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform("")).toBe("");
  });
});
