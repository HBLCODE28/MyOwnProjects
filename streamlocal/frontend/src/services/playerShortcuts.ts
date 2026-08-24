export type PlayerShortcutAction =
  | "toggle-playback"
  | "seek-back-5"
  | "seek-forward-5"
  | "seek-back-10"
  | "seek-forward-10"
  | "toggle-fullscreen"
  | "close";

export function playerShortcutFromKeyboardEvent(
  event: Pick<KeyboardEvent, "code" | "key">,
): PlayerShortcutAction | null {
  switch (event.code) {
    case "Space":
    case "KeyK":
      return "toggle-playback";
    case "ArrowLeft":
      return "seek-back-5";
    case "ArrowRight":
      return "seek-forward-5";
    case "KeyJ":
      return "seek-back-10";
    case "KeyL":
      return "seek-forward-10";
    case "KeyF":
      return "toggle-fullscreen";
    case "Escape":
      return "close";
  }

  // Fallback for environments that do not expose a useful event.code.
  switch (event.key.toLowerCase()) {
    case " ":
    case "k":
      return "toggle-playback";
    case "j":
      return "seek-back-10";
    case "l":
      return "seek-forward-10";
    case "f":
      return "toggle-fullscreen";
    case "escape":
      return "close";
    default:
      return null;
  }
}
