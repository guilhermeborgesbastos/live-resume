import { describe, expect, it } from "vitest";
import { clientAddress } from "../src/core/client-address";

const FRONT_END = "169.254.1.1";

describe("clientAddress", () => {
  it("takes the address the trusted front end appended, not the caller's own entries", () => {
    expect(clientAddress("203.0.113.7", FRONT_END, 1)).toBe("203.0.113.7");
    expect(clientAddress("198.51.100.1, 203.0.113.7", FRONT_END, 1)).toBe("203.0.113.7");
    expect(clientAddress("10.0.0.1, 192.0.2.99, 203.0.113.7", FRONT_END, 1)).toBe("203.0.113.7");
  });

  it("gives the same visitor the same address whatever they forge in front", () => {
    const forged = ["1.1.1.1", "2.2.2.2, 3.3.3.3", "not-an-ip", ""].map(prefix => clientAddress(`${prefix}, 203.0.113.7`, FRONT_END, 1));
    expect(new Set(forged)).toEqual(new Set(["203.0.113.7"]));
  });

  it("supports more trusted hops and repeated headers", () => {
    expect(clientAddress("1.1.1.1, 203.0.113.7, 10.1.1.1", FRONT_END, 2)).toBe("203.0.113.7");
    expect(clientAddress(["1.1.1.1", "203.0.113.7"], FRONT_END, 1)).toBe("203.0.113.7");
    expect(clientAddress("2001:db8::7", FRONT_END, 1)).toBe("2001:db8::7");
  });

  it("refuses when the chain is too short or the entry isn't an address", () => {
    expect(clientAddress(undefined, FRONT_END, 1)).toBeNull();
    expect(clientAddress("", undefined, 1)).toBeNull();
    expect(clientAddress("garbage", FRONT_END, 1)).toBeNull();
    expect(clientAddress("203.0.113.7", FRONT_END, -1)).toBeNull();
  });
});
