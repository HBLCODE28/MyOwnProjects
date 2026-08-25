import { describe, expect, it } from "vitest";
import {
  isContextCompatibleLogoCandidate,
  isNamedLogoUrlContextCompatible,
} from "./wikimediaLogoProvider";

describe("Wikimedia logo title validation", () => {
  it("rejects a remastered game logo for the TV series with the same base title", () => {
    expect(isContextCompatibleLogoCandidate(
      "The Last of Us",
      "File:The Last of Us Remastered logo.png",
      { kind: "series", year: 2023 },
    )).toBe(false);
  });

  it("rejects the same remastered mismatch when it is already stored as an image URL", () => {
    expect(isNamedLogoUrlContextCompatible(
      "The Last of Us",
      "https://upload.wikimedia.org/The_Last_of_Us_Remastered_logo.png",
      { kind: "series", year: 2023 },
    )).toBe(false);
  });

  it("accepts a TV-series logo for the exact series title", () => {
    expect(isContextCompatibleLogoCandidate(
      "The Last of Us",
      "File:The Last of Us (TV series) logo.svg",
      { kind: "series", year: 2023 },
    )).toBe(true);
  });

  it("rejects a television-series logo when searching for a movie", () => {
    expect(isContextCompatibleLogoCandidate(
      "Dune",
      "File:Dune television series logo.svg",
      { kind: "movie", year: 2021 },
    )).toBe(false);
  });

  it("rejects a different-year movie logo when the year is explicit", () => {
    expect(isContextCompatibleLogoCandidate(
      "Dune",
      "File:Dune 1984 film logo.svg",
      { kind: "movie", year: 2021 },
    )).toBe(false);
  });
});
