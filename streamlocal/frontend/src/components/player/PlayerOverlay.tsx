import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../../types/library";
import {
  createPlayableMedia,
  releasePlayableMedia,
  type PlayableMedia,
} from "../../services/localPlayback";
import {
  getPlaybackProgress,
  savePlaybackProgress,
} from "../../services/playbackProgress";
import {
  playerShortcutFromKeyboardEvent,
  type PlayerShortcutAction,
} from "../../services/playerShortcuts";
import "../../styles/player.css";

type Props = {
  item: MediaItem;
  onClose: () => void;
  onProgressChanged?: () => void;
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
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onProgressChangedRef = useRef(onProgressChanged);
  const lastSavedSecondRef = useRef(-1);

  const [media, setMedia] = useState<PlayableMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
    onProgressChangedRef.current = onProgressChanged;
  }, [onClose, onProgressChanged]);

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

  async function persistProgress(video: HTMLVideoElement) {
    const result = await savePlaybackProgress(
      item,
      video.currentTime,
      video.duration,
    );

    if (result) onProgressChangedRef.current?.();
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
        if (!document.fullscreenElement) onCloseRef.current();
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

  return (
    <div className="player-backdrop" ref={shellRef}>
      <div className="player-topbar">
        <div>
          <p className="eyebrow">
            LOCAL PLAYBACK {media ? `· ${media.extension.toUpperCase()}` : ""}
          </p>
          <h2>{item.episodeTitle || item.title}</h2>
        </div>

        <button
          className="player-icon-button"
          onClick={async () => {
            if (videoRef.current) {
              await persistProgress(videoRef.current);
            }
            onClose();
          }}
          aria-label="Close player"
        >
          Close
        </button>
      </div>

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
          />
        )}
      </div>

      {media && !error && (
        <div className="player-controls">
          <input
            className="player-seek"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(current, duration || 0)}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = value;
              setCurrent(value);
            }}
            aria-label="Seek"
          />

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
