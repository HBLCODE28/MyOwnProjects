import { describe, expect, it } from "vitest";
import { playerShortcutFromKeyboardEvent } from "./playerShortcuts";

describe("player keyboard shortcuts", () => {
  it("uses physical J/L/F keys even when key values come from a non-English layout", () => {
    expect(playerShortcutFromKeyboardEvent({ code: "KeyJ", key: "ח" })).toBe("seek-back-10");
    expect(playerShortcutFromKeyboardEvent({ code: "KeyL", key: "ך" })).toBe("seek-forward-10");
    expect(playerShortcutFromKeyboardEvent({ code: "KeyF", key: "כ" })).toBe("toggle-fullscreen");
  });

  it("maps playback and arrow shortcuts", () => {
    expect(playerShortcutFromKeyboardEvent({ code: "Space", key: " " })).toBe("toggle-playback");
    expect(playerShortcutFromKeyboardEvent({ code: "KeyK", key: "k" })).toBe("toggle-playback");
    expect(playerShortcutFromKeyboardEvent({ code: "ArrowLeft", key: "ArrowLeft" })).toBe("seek-back-5");
    expect(playerShortcutFromKeyboardEvent({ code: "ArrowRight", key: "ArrowRight" })).toBe("seek-forward-5");
  });
});
