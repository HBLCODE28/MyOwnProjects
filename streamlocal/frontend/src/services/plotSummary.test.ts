import { describe, expect, it } from "vitest";
import { concisePlotSummary } from "./plotSummary";

describe("concisePlotSummary", () => {
  it("keeps plot sentences and removes production trivia", () => {
    expect(
      concisePlotSummary(
        "A courier discovers a hidden map. Directed by Jane Doe and released in 2024. She must cross the city before sunrise.",
      ),
    ).toBe("A courier discovers a hidden map. She must cross the city before sunrise.");
  });

  it("strips markup and caps long summaries", () => {
    const result = concisePlotSummary(
      "<p>A hero returns home.</p> <p>The town asks for help.</p> <p>They face a dangerous enemy.</p>",
      45,
    );
    expect(result.length).toBeLessThanOrEqual(46);
    expect(result).toContain("A hero returns home.");
  });

  it("returns an empty string for empty input", () => {
    expect(concisePlotSummary(" ")).toBe("");
  });
});
