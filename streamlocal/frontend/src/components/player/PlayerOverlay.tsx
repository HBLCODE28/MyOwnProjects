import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { MediaItem } from "../../types/library";
import {
  createPlayableMedia,
  releasePlayableMedia,
  subtitleUrl,
  type SubtitleTrack,
  type PlayableMedia,
} from "../../services/localPlayback";
import { downloadOpenSubtitle, searchOpenSubtitles, type OpenSubtitleMatch } from "../../services/openSubtitles";
import {
  getPlaybackProgress,
  markPlaybackStarted,
  savePlaybackProgress,
} from "../../services/playbackProgress";
import {
  playerShortcutFromKeyboardEvent,
  type PlayerShortcutAction,
} from "../../services/playerShortcuts";
import {
  getOrCreateTimelinePreview,
  timelinePreviewPosition,
} from "../../services/timelinePreview";
import {
  activeMediaSegment,
  getMediaSegments,
} from "../../services/mediaSegments";
import type { MediaSegment } from "../../types/library";
import "../../styles/player.css";

type Props = {
  item: MediaItem;
  onClose: () => void;
  onProgressChanged?: () => void;
  onNextEpisode?: () => void;
};

type BrowserAudioTrack = {
  id: string;
  kind: string;
  label: string;
  language: string;
  enabled: boolean;
};

type BrowserAudioTrackList = EventTarget & {
  length: number;
  [index: number]: BrowserAudioTrack;
};

type VideoWithAudioTracks = HTMLVideoElement & {
  audioTracks?: BrowserAudioTrackList;
};

type AudioTrackOption = {
  index: number;
  label: string;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function isTextInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

function mediaErrorMessage(
  video: HTMLVideoElement,
  media: PlayableMedia,
): string {
  const code = video.error?.code;

  if (media.extension === "mkv") {
    if (code === MediaError.MEDIA_ERR_DECODE) {
      return "The MKV container opened, but this browser could not decode one of its video/audio codecs.";
    }

    if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      return "This MKV/codec combination is not supported by the current browser. The original file was not modified.";
    }

    return "This MKV could not be played by the current browser. MKV support depends on the codecs stored inside the file.";
  }

  if (code === MediaError.MEDIA_ERR_DECODE) {
    return "The MP4 opened, but this browser could not decode one of its codecs.";
  }

  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "This MP4/codec combination is not supported by the current browser.";
  }

  return "The browser could not play this local media file.";
}

export function PlayerOverlay({
  item,
  onClose,
  onProgressChanged,
  onNextEpisode,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onProgressChangedRef = useRef(onProgressChanged);
  const lastSavedSecondRef = useRef(-1);
  const previewRequestRef = useRef(0);

  const [media, setMedia] = useState<PlayableMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(0);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [subtitleMatches, setSubtitleMatches] = useState<OpenSubtitleMatch[]>([]);
  const [subtitleBusy, setSubtitleBusy] = useState(false);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const subtitleSeeTimeRef = useRef<number | null>(null);
  const [timelinePreview, setTimelinePreview] = useState<{
    url: string | null;
    positionSeconds: number;
    leftPercent: number;
  } | null>(null);
  const [activeSegment, setActiveSegment] = useState<MediaSegment | null>(null);
  const segmentsRef = useRef<MediaSegment[]>([]);

  useEffect(() => {
    onCloseRef.current = onClose;
    onProgressChangedRef.current = onProgressChanged;
  }, [onClose, onProgressChanged]);

  useEffect(() => {
    document.body.classList.add("player-open");
    void markPlaybackStarted(item).then(() => {
      onProgressChangedRef.current?.();
    });

    return () => {
      document.body.classList.remove("player-open");
    };
  }, [item]);

  useEffect(() => {
    segmentsRef.current = [];
    setActiveSegment(null);
    void getMediaSegments(item.id).then((segments) => {
      segmentsRef.current = segments;
    });
  }, [item.id]);

  useEffect(() => () => {
    if (timelinePreview?.url) URL.revokeObjectURL(timelinePreview.url);
  }, [timelinePreview]);

  useEffect(() => {
    let active = true;
    let loaded: PlayableMedia | null = null;

    createPlayableMedia(item.mediaFileId)
      .then((value) => {
        if (!active) {
          releasePlayableMedia(value);
          return;
        }

        loaded = value;
        setMedia(value);
      })
      .catch((value: unknown) => {
        setError(
          value instanceof Error
            ? value.message
            : "Playback could not start.",
        );
      });

    return () => {
      active = false;
      releasePlayableMedia(loaded);
    };
  }, [item.mediaFileId]);

  useEffect(() => {
    if (!media || media.subtitles.length > 0) return;
    let active = true;
    void searchOpenSubtitles(item)
      .then((matches) => {
        if (!active || matches.length === 0) return;
        setSubtitleMatches(matches);
        setSubtitleMenuOpen(true);
      })
      .catch(() => {
        // Automatic lookup is best-effort. Local playback must remain usable offline.
      });
    return () => {
      active = false;
    };
  }, [item, media]);

  async function persistProgress(video: HTMLVideoElement) {
    const result = await savePlaybackProgress(
      item,
      video.currentTime,
      video.duration,
    );

    if (result) onProgressChangedRef.current?.();
  }

  async function closePlayer() {
    if (videoRef.current) {
      await persistProgress(videoRef.current);
    }

    onCloseRef.current();
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) await video.play();
      else video.pause();
    } catch (value) {
      setError(
        value instanceof Error
          ? `Playback could not start: ${value.message}`
          : "Playback could not start.",
      );
    }
  }

  function seekBy(seconds: number) {
    const video = videoRef.current;
    if (!video) return;

    const maximum =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : Number.POSITIVE_INFINITY;

    video.currentTime = Math.max(
      0,
      Math.min(maximum, video.currentTime + seconds),
    );
  }

  function skipActiveSegment() {
    const video = videoRef.current;
    if (!video || !activeSegment) return;
    if (activeSegment.type === "credits" && onNextEpisode) {
      onNextEpisode();
      return;
    }
    video.currentTime = activeSegment.endSeconds;
    setCurrent(activeSegment.endSeconds);
    setActiveSegment(null);
  }

  async function toggleFullscreen() {
    const shell = shellRef.current;
    if (!shell) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (!document.fullscreenEnabled) {
        setError("Fullscreen is disabled by this browser or page context.");
        return;
      }

      await shell.requestFullscreen();
    } catch (value) {
      setError(
        value instanceof Error
          ? `Fullscreen could not start: ${value.message}`
          : "Fullscreen could not start.",
      );
    }
  }

  function runShortcut(action: PlayerShortcutAction) {
    switch (action) {
      case "toggle-playback":
        void togglePlayback();
        break;
      case "seek-back-5":
        seekBy(-5);
        break;
      case "seek-forward-5":
        seekBy(5);
        break;
      case "seek-back-10":
        seekBy(-10);
        break;
      case "seek-forward-10":
        seekBy(10);
        break;
      case "toggle-fullscreen":
        void toggleFullscreen();
        break;
      case "close":
        if (!document.fullscreenElement) {
          void closePlayer();
        }
        break;
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTextInput(event.target)) return;

      const action = playerShortcutFromKeyboardEvent(event);
      if (!action) return;

      event.preventDefault();
      runShortcut(action);
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  function refreshAudioTracks(video: HTMLVideoElement) {
    const list = (video as VideoWithAudioTracks).audioTracks;

    if (!list || list.length === 0) {
      setAudioTracks([]);
      return;
    }

    const next: AudioTrackOption[] = [];
    let enabledIndex = 0;

    for (let index = 0; index < list.length; index += 1) {
      const track = list[index];
      if (track.enabled) enabledIndex = index;

      next.push({
        index,
        label:
          track.label ||
          track.language ||
          (track.kind
            ? `${track.kind} ${index + 1}`
            : `Audio ${index + 1}`),
      });
    }

    setAudioTracks(next);
    setSelectedAudioTrack(enabledIndex);
  }

  function selectAudioTrack(index: number) {
    const video = videoRef.current as VideoWithAudioTracks | null;
    const list = video?.audioTracks;
    if (!list) return;

    for (let trackIndex = 0; trackIndex < list.length; trackIndex += 1) {
      list[trackIndex].enabled = trackIndex === index;
    }

    setSelectedAudioTrack(index);
  }

  function selectSubtitleTrack(index: number) {
    const tracks = videoRef.current?.textTracks;
    if (!tracks) return;
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex += 1) {
      tracks[trackIndex].mode = index >= 0 && trackIndex === index ? "showing" : "disabled";
    }
    setSelectedSubtitleTrack(index);
  }

  function shiftVtt(text: string, offsetSeconds: number): string {
    const toSeconds = (stamp: string) => {
      const [hours, minutes, seconds] = stamp.split(":").map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    };
    const toStamp = (seconds: number) => {
      const safe = Math.max(0, seconds);
      const hours = Math.floor(safe / 3600);
      const minutes = Math.floor((safe % 3600) / 60);
      const rest = (safe % 60).toFixed(3).padStart(6, "0");
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${rest}`;
    };
    return text.replace(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/g, (_match, start: string, end: string) =>
      `${toStamp(toSeconds(start) + offsetSeconds)} --> ${toStamp(toSeconds(end) + offsetSeconds)}`,
    );
  }

  function applySubtitleOffset(value: number) {
    const track = media?.subtitles[selectedSubtitleTrack];
    if (!track) return;
    const nextOffset = value;
    const nextTrack: SubtitleTrack = {
      ...track,
      src: subtitleUrl(shiftVtt(track.text, nextOffset)),
    };
    URL.revokeObjectURL(track.src);
    setMedia((current) => current ? {
      ...current,
      subtitles: current.subtitles.map((entry, index) => index === selectedSubtitleTrack ? nextTrack : entry),
    } : current);
    setSubtitleOffset(nextOffset);
  }

  function markSubtitleSeen() {
    subtitleSeeTimeRef.current = videoRef.current?.currentTime ?? null;
    setError("Subtitle calibration: now press ‘I HEAR THE LINE NOW’ when the audio line is heard.");
  }

  function markSubtitleHeard() {
    const seenAt = subtitleSeeTimeRef.current;
    const heardAt = videoRef.current?.currentTime;
    if (seenAt == null || heardAt == null) {
      setError("Press ‘I SEE THE LINE NOW’ first.");
      return;
    }
    applySubtitleOffset(subtitleOffset + (heardAt - seenAt));
    subtitleSeeTimeRef.current = null;
    setError(null);
  }

  async function findOpenSubtitles() {
    setSubtitleBusy(true);
    try {
      setSubtitleMatches(await searchOpenSubtitles(item));
    } catch (value) {
      setError(value instanceof Error ? value.message : "OpenSubtitles search failed.");
    } finally {
      setSubtitleBusy(false);
    }
  }

  async function addOpenSubtitle(match: OpenSubtitleMatch) {
    setSubtitleBusy(true);
    try {
      const downloaded = await downloadOpenSubtitle(match);
      const track: SubtitleTrack = {
        id: `opensubtitles-${match.fileId}`,
        label: `${match.label} · Downloaded`,
        language: match.language,
        source: "opensubtitles",
        fileName: downloaded.fileName,
        text: downloaded.text,
        src: downloaded.src,
      };
      setMedia((current) => current ? { ...current, subtitles: [...current.subtitles, track] } : current);
      setSelectedSubtitleTrack(media?.subtitles.length ?? 0);
      setSubtitleMatches([]);
      setError(null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Subtitle download failed.");
    } finally {
      setSubtitleBusy(false);
    }
  }

  async function initializeMedia(video: HTMLVideoElement) {
    setDuration(video.duration);
    refreshAudioTracks(video);

    const previous = await getPlaybackProgress(item.id);

    if (
      previous &&
      !previous.watched &&
      previous.positionSeconds > 10 &&
      previous.positionSeconds < video.duration - 10
    ) {
      video.currentTime = previous.positionSeconds;
      setCurrent(previous.positionSeconds);
    }
  }

  function changeVolume(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    setVolume(value);
  }

  function changeSpeed(value: number) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = value;
    setSpeed(value);
  }

  async function showTimelinePreview(event: PointerEvent<HTMLInputElement>) {
    if (!media || !duration || !Number.isFinite(duration)) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const positionSeconds = timelinePreviewPosition(ratio * duration);
    const halfPreviewPercent = Math.min(45, (80 / bounds.width) * 100);
    const leftPercent = Math.max(
      halfPreviewPercent,
      Math.min(100 - halfPreviewPercent, ratio * 100),
    );
    const requestId = ++previewRequestRef.current;

    setTimelinePreview((previous) => {
      if (previous?.url) URL.revokeObjectURL(previous.url);
      return { url: null, positionSeconds, leftPercent };
    });

    try {
      const url = await getOrCreateTimelinePreview(
        item.mediaFileId,
        media.file,
        positionSeconds,
      );
      if (requestId !== previewRequestRef.current) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      setTimelinePreview({ url, positionSeconds, leftPercent });
    } catch {
      if (requestId === previewRequestRef.current) {
        setTimelinePreview({ url: null, positionSeconds, leftPercent });
      }
    }
  }

  return (
    <div className="player-backdrop" ref={shellRef}>
      <button
        className="player-close-floating"
        onClick={() => void closePlayer()}
        aria-label="Close player"
        title="Close"
      >
        ×
      </button>

      <div className="player-stage">
        {error && (
          <div className="player-error">
            <strong>Playback unavailable</strong>
            <p>{error}</p>
          </div>
        )}

        {!media && !error && (
          <div className="player-loading">Opening local media...</div>
        )}

        {media && !error && (
          <video
            ref={videoRef}
            src={media.url}
            style={{ filter: `brightness(${brightness})` }}
            autoPlay
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={(event) => {
              setPlaying(false);
              void persistProgress(event.currentTarget);
            }}
            onTimeUpdate={(event) => {
              const video = event.currentTarget;
              setCurrent(video.currentTime);
              setActiveSegment(activeMediaSegment(segmentsRef.current, video.currentTime));

              const second = Math.floor(video.currentTime);
              if (
                second > 0 &&
                second % 5 === 0 &&
                second !== lastSavedSecondRef.current
              ) {
                lastSavedSecondRef.current = second;
                void persistProgress(video);
              }
            }}
            onLoadedMetadata={(event) => {
              void initializeMedia(event.currentTarget);
            }}
            onCanPlay={(event) => refreshAudioTracks(event.currentTarget)}
            onEnded={(event) => {
              void persistProgress(event.currentTarget);
            }}
            onError={(event) =>
              setError(mediaErrorMessage(event.currentTarget, media))
            }
            onDoubleClick={() => void toggleFullscreen()}
          >
            {(media.subtitles ?? []).map((track, index) => (
              <track
                key={`${track.id}-${track.src}`}
                kind="subtitles"
                src={track.src}
                srcLang={track.language}
                label={track.label}
                default={index === selectedSubtitleTrack}
              />
            ))}
          </video>
        )}
      </div>

      {media && !error && (
        <div className="player-controls">
          <div className="player-now-playing">
            <span className="eyebrow">LOCAL PLAYBACK</span>
            <strong>{item.episodeTitle || item.title}</strong>
            {activeSegment && (
              <button
                type="button"
                className="player-skip-button"
                onClick={skipActiveSegment}
              >
                {activeSegment.type === "intro"
                  ? "Skip Intro"
                  : activeSegment.type === "recap"
                    ? "Skip Recap"
                    : onNextEpisode ? "Next Episode" : "Skip Credits"}
              </button>
            )}
          </div>

          <div className="player-seek-wrap">
            {timelinePreview?.url && (
              <div
                className="player-timeline-preview"
                style={{ left: `${timelinePreview.leftPercent}%` }}
                aria-hidden="true"
              >
                <img src={timelinePreview.url} alt="" />
                <span>{formatTime(timelinePreview.positionSeconds)}</span>
              </div>
            )}
            <input
              className="player-seek"
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(current, duration || 0)}
              onPointerMove={(event) => void showTimelinePreview(event)}
              onPointerLeave={() => {
                previewRequestRef.current += 1;
                setTimelinePreview((previous) => {
                  if (previous?.url) URL.revokeObjectURL(previous.url);
                  return null;
                });
              }}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (videoRef.current) videoRef.current.currentTime = value;
                setCurrent(value);
              }}
              aria-label="Seek"
            />
          </div>

          <div className="player-control-row">
            <div className="player-control-group">
              <button
                className="player-icon-button"
                onClick={() => void togglePlayback()}
              >
                {playing ? "Pause" : "Play"}
              </button>

              <button className="player-icon-button" onClick={() => seekBy(-10)}>
                -10s
              </button>

              <button className="player-icon-button" onClick={() => seekBy(10)}>
                +10s
              </button>

              <span className="player-time">
                {formatTime(current)} / {formatTime(duration)}
              </span>
            </div>

            <div className="player-control-group">
              <button
                className="player-icon-button"
                aria-expanded={subtitleMenuOpen}
                onClick={() => setSubtitleMenuOpen((open) => !open)}
                title="Playback options"
              >
                ⋯
              </button>

              {subtitleMenuOpen && (
                <div className="player-options-menu">
                  <strong>Playback options</strong>
                  <label className="player-speed">
                    Brightness
                    <input type="range" min="0.5" max="1.8" step="0.05" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} />
                  </label>
                  <label className="player-speed">
                    Subtitles
                    <select
                      value={media.subtitles.length ? selectedSubtitleTrack : -1}
                      onChange={(event) => selectSubtitleTrack(Number(event.target.value))}
                    >
                      <option value={-1}>Off</option>
                      {media.subtitles.map((track, index) => <option key={track.id} value={index}>{track.label}</option>)}
                    </select>
                  </label>
                  <div className="player-option-actions">
                    <button className="player-icon-button" disabled={!media.subtitles.length} onClick={() => applySubtitleOffset(subtitleOffset - .5)}>−0.5s</button>
                    <span>{subtitleOffset >= 0 ? "+" : ""}{subtitleOffset.toFixed(1)}s</span>
                    <button className="player-icon-button" disabled={!media.subtitles.length} onClick={() => applySubtitleOffset(subtitleOffset + .5)}>+0.5s</button>
                  </div>
                  <div className="player-option-actions">
                    <button className="player-icon-button" disabled={!media.subtitles.length} onClick={markSubtitleSeen}>I SEE THE LINE NOW</button>
                    <button className="player-icon-button" disabled={!media.subtitles.length} onClick={markSubtitleHeard}>I HEAR THE LINE NOW</button>
                  </div>
                  <button className="player-icon-button" onClick={() => void findOpenSubtitles()} disabled={subtitleBusy}>
                    {subtitleBusy ? "Searching..." : "Find OpenSubtitles"}
                  </button>
                  {subtitleMatches.map((match) => (
                    <button className="player-subtitle-result" key={`${match.id}-${match.fileId}`} onClick={() => void addOpenSubtitle(match)}>
                      {match.label}{match.hearingImpaired ? " · HI" : ""}
                    </button>
                  ))}
                </div>
              )}

              {audioTracks.length > 1 && (
                <label className="player-speed">
                  Audio
                  <select
                    value={selectedAudioTrack}
                    onChange={(event) =>
                      selectAudioTrack(Number(event.target.value))
                    }
                  >
                    {audioTracks.map((track) => (
                      <option key={track.index} value={track.index}>
                        {track.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="player-volume">
                Volume
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(event) =>
                    changeVolume(Number(event.target.value))
                  }
                />
              </label>

              <label className="player-speed">
                Speed
                <select
                  value={speed}
                  onChange={(event) =>
                    changeSpeed(Number(event.target.value))
                  }
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </label>

              <button
                className="player-icon-button"
                onClick={() => void toggleFullscreen()}
              >
                Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
