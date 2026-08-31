import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  TablerAdjustmentsHorizontalIcon,
  TablerCaptionsIcon,
  TablerMaximizeIcon,
  TablerMinimizeIcon,
  TablerPlayerPauseIcon,
  TablerPlayerPlayIcon,
  TablerRewindBackward10Icon,
  TablerRewindForward10Icon,
  TablerXIcon,
} from "../icons/TablerIcons";
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
  markPlaybackCompleted,
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

const FULLSCREEN_CONTROLS_HIDE_MS = 5000;
const SUBTITLE_LINE_PERCENT = 76;

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

function resolvedVideoDuration(video: HTMLVideoElement): number {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;

  try {
    if (video.seekable.length > 0) {
      const end = video.seekable.end(video.seekable.length - 1);
      if (Number.isFinite(end) && end > 0) return end;
    }
  } catch {
    // Some local containers do not expose a stable seekable range immediately.
  }

  // Do not use buffered.end() as a duration fallback. A partially buffered local
  // file can make the current position look like 90%+ and be marked watched early.
  return 0;
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
  const controlsHideTimerRef = useRef<number | null>(null);
  const progressWriteChainRef = useRef<Promise<void>>(Promise.resolve());
  const resumeAppliedItemRef = useRef<string | null>(null);
  const resumeLookupRef = useRef<Promise<void> | null>(null);
  const resumeTargetRef = useRef<number | null>(null);

  const [media, setMedia] = useState<PlayableMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(0);
  const [playbackMenuOpen, setPlaybackMenuOpen] = useState(false);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [subtitleMatches, setSubtitleMatches] = useState<OpenSubtitleMatch[]>([]);
  const [subtitleBusy, setSubtitleBusy] = useState(false);
  const [subtitleNotice, setSubtitleNotice] = useState<string | null>(null);
  const [subtitleOffset, setSubtitleOffset] = useState(0);
  const [subtitleSeenMark, setSubtitleSeenMark] = useState<number | null>(null);
  const [subtitleHeardMark, setSubtitleHeardMark] = useState<number | null>(null);
  const subtitleOffsetRef = useRef(0);
  const subtitleSeeTimeRef = useRef<number | null>(null);
  const subtitleHearTimeRef = useRef<number | null>(null);
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
    function onFullscreenChange() {
      setFullscreenActive(document.fullscreenElement === shellRef.current);
    }

    onFullscreenChange();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (controlsHideTimerRef.current != null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }

    setControlsVisible(true);

    if (fullscreenActive && !playbackMenuOpen && !subtitleMenuOpen) {
      controlsHideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
        controlsHideTimerRef.current = null;
      }, FULLSCREEN_CONTROLS_HIDE_MS);
    }

    return () => {
      if (controlsHideTimerRef.current != null) {
        window.clearTimeout(controlsHideTimerRef.current);
        controlsHideTimerRef.current = null;
      }
    };
  }, [fullscreenActive, playbackMenuOpen, subtitleMenuOpen]);

  function revealFullscreenControls() {
    if (!fullscreenActive) return;

    setControlsVisible(true);
    if (controlsHideTimerRef.current != null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }

    if (!playbackMenuOpen && !subtitleMenuOpen) {
      controlsHideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
        controlsHideTimerRef.current = null;
      }, FULLSCREEN_CONTROLS_HIDE_MS);
    }
  }

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
    resumeAppliedItemRef.current = null;
    resumeLookupRef.current = null;
    resumeTargetRef.current = null;
    lastSavedSecondRef.current = -1;

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

  function queueProgressSave(
    positionSeconds: number,
    durationSeconds: number,
    completed: boolean,
  ): Promise<void> {
    const snapshotItem = item;
    const write = async () => {
      const result = completed
        ? await markPlaybackCompleted(snapshotItem, positionSeconds, durationSeconds)
        : await savePlaybackProgress(snapshotItem, positionSeconds, durationSeconds);
      if (result) onProgressChangedRef.current?.();
    };

    progressWriteChainRef.current = progressWriteChainRef.current
      .catch(() => undefined)
      .then(write);
    return progressWriteChainRef.current;
  }

  function persistProgress(video: HTMLVideoElement, completed = video.ended): Promise<void> {
    return queueProgressSave(
      video.currentTime,
      resolvedVideoDuration(video),
      completed,
    );
  }

  async function closePlayer() {
    if (videoRef.current) {
      await persistProgress(videoRef.current);
    } else {
      await progressWriteChainRef.current.catch(() => undefined);
    }

    onCloseRef.current();
  }

  useEffect(() => {
    const persistCurrentPosition = () => {
      const video = videoRef.current;
      if (video) void persistProgress(video);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistCurrentPosition();
    };

    window.addEventListener("pagehide", persistCurrentPosition);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", persistCurrentPosition);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      persistCurrentPosition();
    };
  }, [item.id]);

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

  function positionSubtitleCues(track: TextTrack) {
    const cues = track.cues;
    if (!cues) return;

    for (let cueIndex = 0; cueIndex < cues.length; cueIndex += 1) {
      const cue = cues[cueIndex] as VTTCue;
      // Native browser subtitles sit almost on the bottom edge of the video.
      // Keep them above the fixed player controls so multi-line cues stay visible.
      cue.snapToLines = false;
      cue.line = SUBTITLE_LINE_PERCENT;
      cue.lineAlign = "center";
    }
  }

  function applySubtitleTrackMode(index: number) {
    const video = videoRef.current;
    if (!video) return;

    const elements = Array.from(video.querySelectorAll<HTMLTrackElement>('track[kind="subtitles"]'));
    elements.forEach((element, trackIndex) => {
      element.track.mode = index >= 0 && trackIndex === index ? "showing" : "disabled";
      if (trackIndex === index) positionSubtitleCues(element.track);
    });
  }

  function activateSubtitleElement(element: HTMLTrackElement, index: number) {
    const video = videoRef.current;
    if (!video) return;

    const elements = Array.from(video.querySelectorAll<HTMLTrackElement>('track[kind="subtitles"]'));
    elements.forEach((candidate, trackIndex) => {
      candidate.track.mode = selectedSubtitleTrack >= 0 && trackIndex === selectedSubtitleTrack
        ? "showing"
        : "disabled";
    });

    if (index === selectedSubtitleTrack) {
      element.track.mode = "showing";
      positionSubtitleCues(element.track);
    }
  }

  function selectSubtitleTrack(index: number) {
    applySubtitleTrackMode(index);
    setSelectedSubtitleTrack(index);
    subtitleSeeTimeRef.current = null;
    subtitleHearTimeRef.current = null;
    setSubtitleSeenMark(null);
    setSubtitleHeardMark(null);
    const track = index >= 0 ? media?.subtitles[index] : null;
    const offset = track?.offsetSeconds ?? 0;
    subtitleOffsetRef.current = offset;
    setSubtitleOffset(offset);
    setSubtitleNotice(null);
  }

  useEffect(() => {
    if (!media) return;
    const frame = window.requestAnimationFrame(() => {
      applySubtitleTrackMode(selectedSubtitleTrack);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [media?.subtitles, selectedSubtitleTrack]);

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

  function applySubtitleOffset(value: number): boolean {
    const track = media?.subtitles[selectedSubtitleTrack];
    const video = videoRef.current;
    if (!track || !video || selectedSubtitleTrack < 0 || !Number.isFinite(value)) return false;

    const nextOffset = Math.max(-120, Math.min(120, value));
    const previousOffset = subtitleOffsetRef.current;
    const delta = nextOffset - previousOffset;
    if (Math.abs(delta) < 0.001) return true;

    const elements = Array.from(video.querySelectorAll<HTMLTrackElement>('track[kind="subtitles"]'));
    const element = elements[selectedSubtitleTrack];
    const cues = element?.track.cues;
    let shiftedLoadedCues = false;

    if (cues && cues.length > 0) {
      for (let cueIndex = 0; cueIndex < cues.length; cueIndex += 1) {
        const cue = cues[cueIndex];
        const shiftedStart = cue.startTime + delta;
        const shiftedEnd = cue.endTime + delta;
        cue.startTime = Math.max(0, shiftedStart);
        cue.endTime = Math.max(cue.startTime + 0.001, shiftedEnd);
      }
      shiftedLoadedCues = true;
    }

    subtitleOffsetRef.current = nextOffset;
    setSubtitleOffset(nextOffset);

    if (shiftedLoadedCues) {
      setMedia((current) => current ? {
        ...current,
        subtitles: current.subtitles.map((entry, index) =>
          index === selectedSubtitleTrack ? { ...entry, offsetSeconds: nextOffset } : entry),
      } : current);
      applySubtitleTrackMode(selectedSubtitleTrack);
      return true;
    }

    // Fallback for a track whose cues have not loaded yet. Recreate the element
    // with a new Blob URL and revision, then reactivate it from its load event.
    const oldSrc = track.src;
    const nextTrack: SubtitleTrack = {
      ...track,
      offsetSeconds: nextOffset,
      renderRevision: (track.renderRevision ?? 0) + 1,
      src: subtitleUrl(shiftVtt(track.text, nextOffset)),
    };

    setMedia((current) => current ? {
      ...current,
      subtitles: current.subtitles.map((entry, index) =>
        index === selectedSubtitleTrack ? nextTrack : entry),
    } : current);

    window.setTimeout(() => URL.revokeObjectURL(oldSrc), 1000);
    window.setTimeout(() => applySubtitleTrackMode(selectedSubtitleTrack), 75);
    return true;
  }

  function finishSubtitleCalibrationIfReady(): boolean {
    const seenAt = subtitleSeeTimeRef.current;
    const heardAt = subtitleHearTimeRef.current;
    if (seenAt == null || heardAt == null) return false;

    const delta = heardAt - seenAt;
    const nextOffset = subtitleOffsetRef.current + delta;
    if (!applySubtitleOffset(nextOffset)) {
      setSubtitleNotice("The selected subtitle track could not be adjusted.");
      return false;
    }

    subtitleSeeTimeRef.current = null;
    subtitleHearTimeRef.current = null;
    setSubtitleSeenMark(null);
    setSubtitleHeardMark(null);
    setSubtitleNotice(`Subtitle sync adjusted by ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}s. Total offset: ${nextOffset >= 0 ? "+" : ""}${nextOffset.toFixed(2)}s.`);
    return true;
  }

  function markSubtitleSeen() {
    const track = media?.subtitles[selectedSubtitleTrack];
    const video = videoRef.current;
    if (!track || selectedSubtitleTrack < 0) {
      setSubtitleNotice("Select a subtitle track first.");
      return;
    }
    if (!video || !Number.isFinite(video.currentTime)) {
      setSubtitleNotice("Playback time is not available yet.");
      return;
    }

    subtitleSeeTimeRef.current = video.currentTime;
    setSubtitleSeenMark(video.currentTime);
    if (finishSubtitleCalibrationIfReady()) return;
    setSubtitleNotice(`Subtitle marked at ${formatTime(video.currentTime)}. Press I HEAR THE LINE NOW when the matching audio is heard.`);
  }

  function markSubtitleHeard() {
    const track = media?.subtitles[selectedSubtitleTrack];
    const video = videoRef.current;
    if (!track || selectedSubtitleTrack < 0) {
      setSubtitleNotice("Select a subtitle track first.");
      return;
    }
    if (!video || !Number.isFinite(video.currentTime)) {
      setSubtitleNotice("Playback time is not available yet.");
      return;
    }

    subtitleHearTimeRef.current = video.currentTime;
    setSubtitleHeardMark(video.currentTime);
    if (finishSubtitleCalibrationIfReady()) return;
    setSubtitleNotice(`Audio marked at ${formatTime(video.currentTime)}. Press I SEE THE LINE NOW when the matching subtitle appears.`);
  }

  async function findOpenSubtitles() {
    setSubtitleBusy(true);
    try {
      const matches = (await searchOpenSubtitles(item)).slice(0, 6);
      setSubtitleMatches(matches);
      setSubtitleNotice(matches.length ? null : `No exact subtitle matches were found for "${item.title}".`);
    } catch (value) {
      setSubtitleNotice(value instanceof Error ? value.message : "OpenSubtitles search failed.");
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
        offsetSeconds: 0,
        src: downloaded.src,
      };
      setMedia((current) => current ? { ...current, subtitles: [...current.subtitles, track] } : current);
      setSelectedSubtitleTrack(media?.subtitles.length ?? 0);
      setSubtitleMatches([]);
      setSubtitleNotice(null);
    } catch (value) {
      setSubtitleNotice(value instanceof Error ? value.message : "Subtitle download failed.");
    } finally {
      setSubtitleBusy(false);
    }
  }

  function canSeekToResumeTarget(video: HTMLVideoElement, target: number): boolean {
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) return false;
    try {
      if (video.seekable.length === 0) return false;
      for (let index = 0; index < video.seekable.length; index += 1) {
        const start = video.seekable.start(index);
        const end = video.seekable.end(index);
        if (target >= Math.max(0, start - 0.25) && target <= end + 0.25) return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function confirmResumeIfApplied(video: HTMLVideoElement) {
    const target = resumeTargetRef.current;
    if (target == null) return;
    if (Math.abs(video.currentTime - target) <= 1.5) {
      resumeAppliedItemRef.current = item.id;
      resumeTargetRef.current = null;
      setCurrent(video.currentTime);
    }
  }

  async function restoreSavedResume(video: HTMLVideoElement) {
    if (resumeAppliedItemRef.current === item.id) return;
    if (resumeTargetRef.current != null) {
      if (canSeekToResumeTarget(video, resumeTargetRef.current)) {
        try {
          video.currentTime = resumeTargetRef.current;
          window.requestAnimationFrame(() => confirmResumeIfApplied(video));
        } catch {
          // A later media readiness event will retry.
        }
      }
      return;
    }
    if (resumeLookupRef.current) {
      await resumeLookupRef.current;
      return;
    }

    const lookup = (async () => {
      const previous = await getPlaybackProgress(item.id);
      if (!previous || previous.watched || previous.positionSeconds <= 1) return;

      const knownDuration = resolvedVideoDuration(video);
      if (knownDuration > 0 && previous.positionSeconds >= knownDuration - 1) return;

      // Setting currentTime too early on a local Blob URL can be silently ignored
      // by Chromium without throwing. Keep the target pending until seekable ranges
      // confirm that the browser can actually seek there.
      resumeTargetRef.current = previous.positionSeconds;
      if (!canSeekToResumeTarget(video, previous.positionSeconds)) return;

      try {
        video.currentTime = previous.positionSeconds;
        setCurrent(previous.positionSeconds);
        window.requestAnimationFrame(() => confirmResumeIfApplied(video));
      } catch {
        // onCanPlay/onProgress/onDurationChange will retry once seekable.
      }
    })();

    resumeLookupRef.current = lookup;
    try {
      await lookup;
    } finally {
      if (resumeLookupRef.current === lookup) resumeLookupRef.current = null;
    }
  }

  async function initializeMedia(video: HTMLVideoElement) {
    const knownDuration = resolvedVideoDuration(video);
    if (knownDuration > 0) setDuration(knownDuration);
    refreshAudioTracks(video);
    await restoreSavedResume(video);
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

    if (!media.file) return;

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
    <div
      className={`player-backdrop ${fullscreenActive && !controlsVisible ? "player-controls-hidden" : ""}`}
      ref={shellRef}
      onPointerMove={revealFullscreenControls}
    >
      <button
        className="player-close-floating"
        onPointerEnter={revealFullscreenControls}
        onClick={() => void closePlayer()}
        aria-label="Close player"
        title="Close"
      >
        <TablerXIcon size={24} />
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
            onCanPlay={(event) => {
              refreshAudioTracks(event.currentTarget);
              void restoreSavedResume(event.currentTarget);
            }}
            onProgress={(event) => {
              void restoreSavedResume(event.currentTarget);
            }}
            onSeeked={(event) => {
              confirmResumeIfApplied(event.currentTarget);
            }}
            onDurationChange={(event) => {
              const knownDuration = resolvedVideoDuration(event.currentTarget);
              if (knownDuration > 0) setDuration(knownDuration);
              void restoreSavedResume(event.currentTarget);
            }}
            onEnded={(event) => {
              const video = event.currentTarget;
              setPlaying(false);
              const completedPosition =
                Number.isFinite(video.duration) && video.duration > 0
                  ? video.duration
                  : video.currentTime;
              setCurrent(completedPosition);
              void persistProgress(video, true);
            }}
            onError={(event) =>
              setError(mediaErrorMessage(event.currentTarget, media))
            }
            onDoubleClick={() => void toggleFullscreen()}
          >
            {(media.subtitles ?? []).map((track, index) => (
              <track
                key={`${track.id}-${track.renderRevision ?? 0}-${track.src}`}
                kind="subtitles"
                src={track.src}
                srcLang={track.language}
                label={track.label}
                default={index === selectedSubtitleTrack}
                onLoad={(event) => activateSubtitleElement(event.currentTarget, index)}
              />
            ))}
          </video>
        )}
      </div>

      {media && !error && (
        <div
          className="player-controls"
          onPointerEnter={revealFullscreenControls}
          onPointerLeave={revealFullscreenControls}
        >
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
                className="player-icon-button player-icon-only player-primary-control"
                onClick={() => void togglePlayback()}
                aria-label={playing ? "Pause" : "Play"}
                title={playing ? "Pause" : "Play"}
              >
                {playing ? <TablerPlayerPauseIcon size={25} /> : <TablerPlayerPlayIcon size={25} />}
              </button>

              <button
                className="player-icon-button player-icon-only"
                onClick={() => seekBy(-10)}
                aria-label="Back 10 seconds"
                title="Back 10 seconds"
              >
                <TablerRewindBackward10Icon size={25} />
              </button>

              <button
                className="player-icon-button player-icon-only"
                onClick={() => seekBy(10)}
                aria-label="Forward 10 seconds"
                title="Forward 10 seconds"
              >
                <TablerRewindForward10Icon size={25} />
              </button>

              <span className="player-time">
                {formatTime(current)} / {formatTime(duration)}
              </span>
            </div>

            <div className="player-control-group">
              <button
                className="player-icon-button player-icon-only"
                aria-expanded={playbackMenuOpen}
                aria-label="Playback options"
                onClick={() => {
                  setPlaybackMenuOpen((open) => !open);
                  setSubtitleMenuOpen(false);
                }}
                title="Playback options"
              >
                <TablerAdjustmentsHorizontalIcon size={25} />
              </button>

              {playbackMenuOpen && (
                <div className="player-options-menu">
                  <strong>Playback options</strong>
                  <label className="player-speed">
                    Brightness
                    <input type="range" min="0.5" max="1.8" step="0.05" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} />
                  </label>
                  <label className="player-speed">
                    Speed
                    <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                        <option key={value} value={value}>{value}x</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <button
                className="player-icon-button player-icon-only"
                aria-expanded={subtitleMenuOpen}
                aria-label="Subtitle options"
                onClick={() => {
                  setSubtitleMenuOpen((open) => !open);
                  setPlaybackMenuOpen(false);
                }}
                title="Subtitle options"
              >
                <TablerCaptionsIcon size={25} />
              </button>

              {subtitleMenuOpen && (
                <div className="player-options-menu player-subtitle-menu">
                  <strong>Subtitle options</strong>
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
                    <button type="button" className="player-icon-button" disabled={!media.subtitles.length || selectedSubtitleTrack < 0} onClick={markSubtitleSeen}>
                      {subtitleSeenMark == null ? "I SEE THE LINE NOW" : `SEEN ${formatTime(subtitleSeenMark)}`}
                    </button>
                    <button type="button" className="player-icon-button" disabled={!media.subtitles.length || selectedSubtitleTrack < 0} onClick={markSubtitleHeard}>
                      {subtitleHeardMark == null ? "I HEAR THE LINE NOW" : `HEARD ${formatTime(subtitleHeardMark)}`}
                    </button>
                  </div>
                  <button className="player-icon-button" onClick={() => void findOpenSubtitles()} disabled={subtitleBusy}>
                    {subtitleBusy ? "Searching..." : "Find OpenSubtitles"}
                  </button>
                  {subtitleMatches.map((match, index) => (
                    <button className="player-subtitle-result" key={`${match.id}-${match.fileId}`} onClick={() => void addOpenSubtitle(match)}>
                      {index === 0 ? "Best match · " : ""}{match.label}{match.hearingImpaired ? " · HI" : ""}
                    </button>
                  ))}
                  {subtitleNotice && <p className="player-subtitle-notice">{subtitleNotice}</p>}
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
                className="player-icon-button player-icon-only"
                onClick={() => void toggleFullscreen()}
                aria-label={fullscreenActive ? "Exit fullscreen" : "Enter fullscreen"}
                title={fullscreenActive ? "Exit fullscreen" : "Fullscreen"}
              >
                {fullscreenActive ? <TablerMinimizeIcon size={25} /> : <TablerMaximizeIcon size={25} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
