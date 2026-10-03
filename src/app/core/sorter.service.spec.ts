import { SorterService } from "./sorter.service";

describe("SorterService", () => {
  const sorter = new SorterService();
  const items = () => [
    { position: 2, name: "beta" },
    { position: 3, name: "Alpha" },
    { position: 1, name: "gamma" }
  ];

  it("sorts numbers ascending by default", () => {
    expect(items().sort(sorter.sort("position")).map(i => i.position)).toEqual([1, 2, 3]);
  });

  it("sorts descending", () => {
    expect(items().sort(sorter.sort("position", "desc")).map(i => i.position)).toEqual([3, 2, 1]);
  });

  it("compares strings case-insensitively", () => {
    expect(items().sort(sorter.sort("name")).map(i => i.name)).toEqual(["Alpha", "beta", "gamma"]);
  });

  it("leaves items in place when the key is missing", () => {
    expect(items().sort(sorter.sort("missing")).map(i => i.position)).toEqual([2, 3, 1]);
  });
});
