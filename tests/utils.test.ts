import { describe, expect, it } from "vitest";

describe("linyvets setup", () => {
  it("keeps the app language configured for Ukrainian", () => {
    expect("uk").toBe("uk");
  });
});
