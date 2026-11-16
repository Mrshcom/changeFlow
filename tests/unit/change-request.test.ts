import { describe, expect, it } from "vitest";
import { parseRequestInput } from "@/lib/domain/change-request";

describe("parseRequestInput", () => {
  it("trims and returns all required fields", () => {
    expect(parseRequestInput({ title: "  Change  ", description: " Details\n", reason: " Capacity " })).toEqual({
      title: "Change",
      description: "Details",
      reason: "Capacity",
    });
  });

  it.each(["title", "description", "reason"] as const)("rejects a missing %s", (field) => {
    const input: Record<string, unknown> = { title: "Title", description: "Details", reason: "Reason" };
    delete input[field];

    expect(() => parseRequestInput(input)).toThrow(`${field} is required`);
  });

  it.each(["", "   ", "\t\n"])("rejects a blank required value (%j)", (blank) => {
    expect(() => parseRequestInput({ title: blank, description: "Details", reason: "Reason" })).toThrow(
      "title is required",
    );
  });
});
