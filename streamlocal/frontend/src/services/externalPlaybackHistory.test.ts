import { describe, expect, it } from "vitest";
import {
  parseVlcRecentHistory,
  parseWindowsMediaPlayerAppState,
  parseLivePlaybackHistory,
  normalizePickerId,
} from "./externalPlaybackHistory";

describe("external playback history", () => {
  it("parses VLC video positions and completed entries", () => {
    const rows = parseVlcRecentHistory(`
[General]
foo=bar
[RecentsMRL]
list=file:///C:/Videos/House.S01E01.mkv, file:///C:/Videos/Interstellar.2014.mp4, file:///C:/Music/song.mp3
times=125000, 0, 22000
[Preferences]
foo=bar
`);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      path: "file:///C:/Videos/House.S01E01.mkv",
      positionSeconds: 125,
      completed: false,
      source: "vlc",
    });
    expect(rows[1]).toMatchObject({
      path: "file:///C:/Videos/Interstellar.2014.mp4",
      positionSeconds: 0,
      completed: true,
      source: "vlc",
    });
  });

  it("extracts a Windows Media Player AppState path and playback position", () => {
    const rows = parseWindowsMediaPlayerAppState(JSON.stringify({
      playback: {
        currentPosition: "00:12:34",
        duration: "00:45:00",
        sourceUri: "file:///C:/Videos/House.S01E02.mkv",
      },
    }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      path: "file:///C:/Videos/House.S01E02.mkv",
      positionSeconds: 754,
      durationSeconds: 2700,
      completed: false,
      source: "windows_media_player",
    });
  });

  it("parses live Windows playback timeline records for completion tracking", () => {
    const rows = parseLivePlaybackHistory(JSON.stringify({
      version: 1,
      records: [{
        source: "windows_media_player",
        sourceAppUserModelId: "Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic",
        title: "Interstellar",
        positionSeconds: 7070,
        durationSeconds: 7200,
        firstSeenAt: "2026-08-26T06:00:00.000Z",
        lastSeenAt: "2026-08-26T07:57:50.000Z",
        completed: false,
      }],
    }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      path: null,
      title: "Interstellar",
      positionSeconds: 7070,
      durationSeconds: 7200,
      source: "windows_media_player",
    });
    expect(rows[0].playedAt).toBe(Date.parse("2026-08-26T06:00:00.000Z"));
  });

  it("normalizes file-picker ids to Chromium's 32-character limit", () => {
    const id = normalizePickerId("streamlocal-windows-media-player-history/with spaces");
    expect(id.length).toBeLessThanOrEqual(32);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

});
