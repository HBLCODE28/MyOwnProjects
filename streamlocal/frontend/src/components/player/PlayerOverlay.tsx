import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../../types/library";
import {
  createPlayableMedia,
  releasePlayableMedia,
  type PlayableMedia,
} from "../../services/localPlayback";
import "../../styles/player.css";

type Props = {
  item: MediaItem;
  onClose: () => void;
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

export function PlayerOverlay({ item, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [media, setMedia] = useState<PlayableMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);

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
        setError(value instanceof Error ? value.message : "Playback could not start.");
      });

    return () => {
      active = false;
      releasePlayableMedia(loaded);
    };
  }, [item.mediaFileId]);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play();
    else video.pause();
  }

  function seekBy(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
  }

  async function toggleFullscreen() {
    const shell = shellRef.current;
    if (!shell) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await shell.requestFullscreen();
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case " ":
        case "k":
          event.preventDefault();
          void togglePlayback();
          break;
        case "arrowleft":
          event.preventDefault();
          seekBy(-5);
          break;
        case "arrowright":
          event.preventDefault();
          seekBy(5);
          break;
        case "j":
          event.preventDefault();
          seekBy(-10);
          break;
        case "l":
          event.preventDefault();
          seekBy(10);
          break;
        case "f":
          event.preventDefault();
          void toggleFullscreen();
          break;
        case "escape":
          if (!document.fullscreenElement) onClose();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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
          <p className="eyebrow">LOCAL PLAYBACK</p>
          <h2>{item.episodeTitle || item.title}</h2>
        </div>
        <button className="player-icon-button" onClick={onClose} aria-label="Close player">
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

        {!media && !error && <div className="player-loading">Opening local media...</div>}

        {media && (
          <video
            ref={videoRef}
            src={media.url}
            autoPlay
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            onDoubleClick={() => void toggleFullscreen()}
          />
        )}
      </div>

      {media && (
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
              <button className="player-icon-button" onClick={() => void togglePlayback()}>
                {playing ? "Pause" : "Play"}
              </button>
              <button className="player-icon-button" onClick={() => seekBy(-10)}>-10s</button>
              <button className="player-icon-button" onClick={() => seekBy(10)}>+10s</button>
              <span className="player-time">
                {formatTime(current)} / {formatTime(duration)}
              </span>
            </div>

            <div className="player-control-group">
              <label className="player-volume">
                Volume
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                />
              </label>

              <label className="player-speed">
                Speed
                <select value={speed} onChange={(event) => changeSpeed(Number(event.target.value))}>
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </label>

              <button className="player-icon-button" onClick={() => void toggleFullscreen()}>
                Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
