import { describe, expect, it } from "vitest";
import { parseReturnReason } from "@/lib/domain/review-decision";

describe("parseReturnReason", () => {
  it.each([undefined, null])("returns null when the reason is omitted or null", (value) => {
    expect(parseReturnReason(value)).toBeNull();
  });

  it.each(["", "   ", "\t\n"])("returns null for a blank reason (%j)", (blank) => {
    expect(parseReturnReason(blank)).toBeNull();
  });

  it("trims and preserves a supplied reason", () => {
    expect(parseReturnReason("  Please add the rollback steps.  ")).toBe("Please add the rollback steps.");
  });

  it.each([42, {}, true])("rejects a supplied non-string reason (%j)", (value) => {
    expect(() => parseReturnReason(value)).toThrow("reason must be a string");
  });
});
