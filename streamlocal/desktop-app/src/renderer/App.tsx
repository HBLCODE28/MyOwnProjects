import { useEffect, useMemo, useRef, useState } from "react";
import type { MediaFile, Source, SubtitleResult } from "../shared/types";

const appLogo = new URL("./assets/streamlocal-icon.svg", import.meta.url).href;
type Data = Awaited<ReturnType<typeof window.streamlocal.library.listFiles>>;
const title = (file: MediaFile) => file.type === "episode" ? `${file.series} · S${String(file.season).padStart(2, "0")}E${String(file.episode).padStart(2, "0")}` : file.title;
const seriesName = (file: MediaFile) => file.series || "Unknown Series";

function Poster({ file, onClick, variant = "portrait" }: { file: MediaFile; onClick: () => void; variant?: "portrait" | "landscape" }) { const image = variant === "landscape" ? file.backdropUrl || file.posterUrl : file.posterUrl || file.backdropUrl; return <button className={`poster ${variant === "landscape" ? "poster-landscape" : ""}`} aria-label={`Play ${title(file)}`} onPointerDown={(event) => event.stopPropagation()} onClick={onClick}>{image && <img src={image} alt="" />}<span>{file.type === "episode" ? "TV" : "FILM"}</span><strong className="media-logo">{file.type === "episode" ? seriesName(file) : file.title}</strong>{file.year && <small>{file.year}</small>}</button>; }
export function App() {
  const [data, setData] = useState<Data | null>(null);
  const [page, setPage] = useState("Home");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [active, setActive] = useState<MediaFile | null>(null);
  const [seriesFromSearch, setSeriesFromSearch] = useState<string | null>(null);
  const refresh = () => window.streamlocal.library.listFiles().then(setData);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast((current) => current === message ? "" : current), 8000); };

  useEffect(() => {
    void refresh();
    const stopScan = window.streamlocal.library.onScanProgress((value: unknown) => { const progress = value as { found: number; current: string }; notify(`Scanning ${progress.found} videos · ${progress.current}`); });
    const stopArtwork = window.streamlocal.library.onArtworkUpdated((value: unknown) => { const result = value as { updated: number }; void refresh(); notify(`${result.updated} poster${result.updated === 1 ? "" : "s"} updated`); });
    return () => { stopScan(); stopArtwork(); };
  }, []);

  async function addFolder() { const source = await window.streamlocal.library.selectFolder(); if (!source) return; notify("Scanning your media folder…"); const result = await window.streamlocal.library.scan(source.id); notify(`Scan complete · ${result.files} videos found`); await refresh(); }
  if (!data) return <main className="loading">Launching StreamLocal…</main>;
  if (!data.onboardingDone) return <Welcome addFolder={addFolder} done={async () => { await window.streamlocal.library.completeOnboarding(); await refresh(); }} scan={toast} files={data.files.length} />;

  const movies = data.files.filter((file) => file.type === "movie");
  const episodes = data.files.filter((file) => file.type === "episode");
  const filtered = data.files.filter((file) => title(file).toLowerCase().includes(query.toLowerCase()));
  const searchResults = filtered.filter((file, index, list) => file.type === "movie" || list.findIndex((candidate) => candidate.type === "episode" && candidate.series === file.series) === index);
  const continueWatching = data.files.filter((file) => { const progress = data.progress[file.id]; return progress && !progress.watched; }).sort((a, b) => data.progress[b.id].lastPlayedAt - data.progress[a.id].lastPlayedAt);
  const openSearchResult = (file: MediaFile) => { if (file.type === "episode" && file.series) { setSeriesFromSearch(file.series); setPage("Series"); } else setActive(file); };

  return <main><header><div className="brand"><img src={appLogo} alt="" /><span>STREAM</span>LOCAL</div><nav>{["Home", "Movies", "Series", "Search", "Settings"].map((item) => <button className={page === item ? "active" : ""} onClick={() => { setPage(item); if (item !== "Series") setSeriesFromSearch(null); }} key={item}>{item}</button>)}</nav></header>{toast && <div className="toast" role="status">{toast}</div>}<section className="content">{page === "Settings" ? <Settings data={data} refresh={refresh} addFolder={addFolder} notify={notify} /> : page === "Search" ? <Search query={query} setQuery={setQuery} results={searchResults} select={openSearchResult} /> : page === "Series" ? <Series files={episodes} select={setActive} initialShow={seriesFromSearch} /> : page === "Movies" ? <><div className="page-title"><div><p className="eyebrow">YOUR COLLECTION</p><h1>Movies</h1><p>{movies.length} local films ready to play.</p></div><button className="library-action" onClick={() => setPage("Settings")}>Manage library</button></div><Rail label="All movies" files={movies} select={setActive} /></> : <Home movies={movies} episodes={episodes} continueWatching={continueWatching} select={setActive} />}</section>{active && <Player file={active} initial={data.progress[active.id]?.position || 0} close={() => setActive(null)} refresh={refresh} />}</main>;
}

function Welcome({ addFolder, done, scan, files }: { addFolder: () => Promise<void>; done: () => Promise<void>; scan: string; files: number }) { return <main className="welcome"><div className="mark">▶</div><p className="eyebrow">WELCOME TO STREAMLOCAL</p><h1>Your library. Your screen.</h1><p>Choose the folder that contains your movies and series. StreamLocal scans it locally—your original files are never moved, changed, or uploaded.</p><button className="primary" onClick={() => void addFolder()}>Choose media folder</button>{scan && <div className="progress">{scan}</div>}{files > 0 && <button className="finish" onClick={() => void done()}>Open library ({files} videos found) →</button>}<small>You can add network folders later in Settings.</small></main>; }

function Rail({ label, files, select, variant = "portrait" }: { label: string; files: MediaFile[]; select: (file: MediaFile) => void; variant?: "portrait" | "landscape" }) { const rail = useRef<HTMLDivElement>(null); const drag = useRef<{ x: number; left: number } | null>(null); const move = (direction: number) => rail.current?.scrollBy({ left: direction * Math.max(rail.current.clientWidth * .78, 260), behavior: "smooth" }); return <section className="rail"><div className="rail-heading"><h2>{label}</h2><div><button aria-label="Previous titles" onClick={() => move(-1)}>‹</button><button aria-label="Next titles" onClick={() => move(1)}>›</button></div></div>{files.length ? <div ref={rail} className="cards" onPointerDown={(event) => { drag.current = { x: event.clientX, left: event.currentTarget.scrollLeft }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (drag.current) event.currentTarget.scrollLeft = drag.current.left - (event.clientX - drag.current.x); }} onPointerUp={() => { drag.current = null; }}>{files.map((file) => <Poster key={file.id} file={file} variant={variant} onClick={() => select(file)} />)}</div> : <p className="empty">Nothing here yet.</p>}</section>; }

function Home({ movies, episodes, continueWatching, select }: { movies: MediaFile[]; episodes: MediaFile[]; continueWatching: MediaFile[]; select: (file: MediaFile) => void }) { const features = useMemo(() => [...movies, ...episodes.filter((file, index, list) => list.findIndex((candidate) => candidate.series === file.series) === index)], [movies, episodes]); const [featureIndex, setFeatureIndex] = useState(0); useEffect(() => { setFeatureIndex((current) => features.length ? current % features.length : 0); if (features.length < 2) return; const timer = window.setInterval(() => setFeatureIndex((current) => (current + 1) % features.length), 3000); return () => window.clearInterval(timer); }, [features.length]); const feature = features[featureIndex]; return <>{feature && <button key={feature.id} className="hero hero-feature" aria-label={`Open ${feature.type === "episode" ? seriesName(feature) : feature.title}`} onClick={() => select(feature)} style={feature.backdropUrl || feature.posterUrl ? { backgroundImage: `linear-gradient(90deg, #000 5%, rgba(0,0,0,.58) 47%, rgba(0,0,0,.14)), url(${feature.backdropUrl || feature.posterUrl})` } : undefined}><span>{feature.type === "episode" ? "SERIES" : "FILM"}</span><strong className="media-logo">{feature.type === "episode" ? seriesName(feature) : feature.title}</strong></button>}{continueWatching.length > 0 && <Rail label="Continue Watching" files={continueWatching} variant="landscape" select={select} />}<Rail label="Movies" files={movies} variant="landscape" select={select} /><Rail label="Recently added episodes" files={episodes.slice(-20).reverse()} variant="landscape" select={select} /></>; }

function Search({ query, setQuery, results, select }: { query: string; setQuery: (value: string) => void; results: MediaFile[]; select: (file: MediaFile) => void }) { return <section className="search-page"><p className="eyebrow">FIND SOMETHING TO WATCH</p><h1>Search</h1><label className="search-wrap"><span aria-hidden="true">⌕</span><input autoFocus className="search" aria-label="Search titles, series or episodes" placeholder="Titles, series or episodes" value={query} onChange={(event) => setQuery(event.target.value)} /></label>{query ? <Rail label={`${results.length} titles for “${query}”`} files={results} select={select} /> : <p className="empty">Start typing to search your library.</p>}</section>; }

function Series({ files, select, initialShow }: { files: MediaFile[]; select: (file: MediaFile) => void; initialShow?: string | null }) { const [show, setShow] = useState<string | null>(initialShow || null); const [query, setQuery] = useState(""); const groups = useMemo(() => Object.entries(files.reduce<Record<string, MediaFile[]>>((all, file) => { (all[seriesName(file)] ||= []).push(file); return all; }, {})).sort(([left], [right]) => left.localeCompare(right)), [files]); const visibleGroups = groups.filter(([name]) => name.toLowerCase().includes(query.toLowerCase())); const episodes = show ? groups.find(([name]) => name === show)?.[1] || [] : []; const seasons = [...new Set(episodes.map((file) => file.season))].sort(); const [season, setSeason] = useState<number | undefined>(); useEffect(() => { if (initialShow) setShow(initialShow); }, [initialShow]); useEffect(() => setSeason(seasons[0]), [show]); if (show) return <><button className="back" onClick={() => setShow(null)}>← All series</button><div className="series-head"><p className="eyebrow">SERIES</p><h1 className="media-logo">{show}</h1><p>{episodes.length} episodes in {seasons.length} season{seasons.length === 1 ? "" : "s"}</p></div>{seasons.length > 1 && <div className="seasons">{seasons.map((number) => <button className={season === number ? "active" : ""} onClick={() => setSeason(number)} key={number}>Season {number}</button>)}</div>}<div className="episodes">{episodes.filter((file) => file.season === season).sort((left, right) => (left.episode || 0) - (right.episode || 0)).map((file) => <button onClick={() => select(file)} key={file.id}><b>Episode {file.episode}</b><span>{file.title}</span><i>Play</i></button>)}</div></>; return <><div className="page-title series-page-title"><div><p className="eyebrow">YOUR COLLECTION</p><h1>Series</h1><p>{groups.length} series in your library.</p></div><label className="series-search">Filter series<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search series" /></label></div><div className="series-grid series-library-grid">{visibleGroups.map(([name, items]) => <button onClick={() => setShow(name)} key={name}>{items[0]?.posterUrl && <img src={items[0].posterUrl} alt="" />}<span>TV</span><strong className="media-logo">{name}</strong><small>{items.length} episodes · {new Set(items.map((item) => item.season)).size} seasons</small></button>)}</div>{!visibleGroups.length && <p className="empty">No series match that search.</p>}</>; }

function Settings({ data, refresh, addFolder, notify }: { data: Data; refresh: () => void; addFolder: () => Promise<void>; notify: (message: string) => void }) { const [key, setKey] = useState(""); const [networkPath, setNetworkPath] = useState(""); const [info, setInfo] = useState(""); const [status, setStatus] = useState<{ hasSubtitleKey: boolean; providerKeys: string[]; encryptionAvailable: boolean } | null>(null); useEffect(() => { void window.streamlocal.settings.get().then(setStatus); }, []); async function saveKey() { await window.streamlocal.settings.set(key); setKey(""); setStatus(await window.streamlocal.settings.get()); setInfo("Subtitle API key saved securely for this Windows account."); } async function addNetworkFolder() { try { const source = await window.streamlocal.library.addNetworkFolder(networkPath); setNetworkPath(""); notify("Scanning network folder…"); const result = await window.streamlocal.library.scan(source.id); await refresh(); notify(`Network scan complete · ${result.files} videos found`); } catch (error) { setInfo(error instanceof Error ? error.message : "Network folder could not be added."); } } return <><h1>Settings</h1><div className="setting"><h2>Media folders</h2><p>Only folders selected here can be read by StreamLocal.</p>{data.sources.map((source: Source) => <div className="source" key={source.id}><span>{source.name}<small>{source.path}</small></span><button onClick={() => void window.streamlocal.library.scan(source.id).then(refresh)}>Rescan</button><button className="danger" onClick={() => void window.streamlocal.library.removeSource(source.id).then(refresh)}>Remove</button></div>)}<button className="primary" onClick={() => void addFolder()}>Add another folder</button><div className="network-folder"><label htmlFor="network-path">Network folder</label><div><input id="network-path" value={networkPath} onChange={(event) => setNetworkPath(event.target.value)} placeholder="\\SERVER\Media" /><button disabled={!networkPath.trim()} onClick={() => void addNetworkFolder()}>Add network folder</button></div><small>Use a Windows shared-folder path, for example \\SERVER\Movies.</small></div></div><div className="setting"><h2>API connections</h2><p>Keys are encrypted by Windows and never added to exports.</p><input type="password" placeholder={status?.hasSubtitleKey ? "OpenSubtitles key saved" : "OpenSubtitles API key"} value={key} onChange={(event) => setKey(event.target.value)} /><button className="primary" disabled={!key || !status?.encryptionAvailable} onClick={() => void saveKey()}>Save OpenSubtitles key</button><ProviderKey name="TVmaze" saved={status?.providerKeys.includes("tvmaze") || false} /><ProviderKey name="Fanart.tv" saved={status?.providerKeys.includes("fanart") || false} /><ProviderKey name="TMDb" saved={status?.providerKeys.includes("tmdb") || false} /><button onClick={async () => { const result = await window.streamlocal.library.syncArtwork(true); await refresh(); setInfo(result.updated ? `${result.updated} posters refreshed.` : "No exact poster matches were found."); }}>Refresh all posters</button>{status && !status.encryptionAvailable && <p className="warning">Windows encryption is unavailable, so keys cannot be saved.</p>}</div>{info && <p className="notice" role="status">{info}</p>}</>; }

function ProviderKey({ name, saved }: { name: string; saved: boolean }) { const [key, setKey] = useState(""); const id = name.toLowerCase().replace(/[^a-z]/g, ""); return <div className="provider-key"><input type="password" value={key} placeholder={saved ? `${name} key saved` : `${name} API key (optional)`} onChange={(event) => setKey(event.target.value)} /><button disabled={!key} onClick={async () => { await window.streamlocal.settings.setProviderKey(id, key); setKey(""); }}>Save</button></div>; }

function Player({ file, initial, close, refresh }: { file: MediaFile; initial: number; close: () => void; refresh: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLTrackElement>(null);
  const [src, setSrc] = useState("");
  const [subs, setSubs] = useState<SubtitleResult[]>([]);
  const [subtitleUrl, setSubtitleUrl] = useState("");
  const [preferred, setPreferred] = useState<{ he?: string; en?: string }>({});
  const [subtitleOpen, setSubtitleOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [rate, setRate] = useState(1);
  const [message, setMessage] = useState("");
  const [seenAt, setSeenAt] = useState<number | null>(null);
  const [heardAt, setHeardAt] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [position, setPosition] = useState(initial);
  const [duration, setDuration] = useState(0);
  const [subtitleQuery, setSubtitleQuery] = useState("");

  useEffect(() => {
    void window.streamlocal.media.open(file.id).then(setSrc).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Playback could not start."));
    void window.streamlocal.subtitles.preferred(file.id).then(setPreferred);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft" && video.current) video.current.currentTime = Math.max(0, video.current.currentTime - 10);
      if (event.key === "ArrowRight" && video.current) video.current.currentTime += 10;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file.id, close]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const save = () => {
      if (Number.isFinite(element.currentTime) && element.currentTime > 0) void window.streamlocal.history.saveProgress(file.id, element.currentTime, element.duration || 0).then(refresh);
    };
    const timer = window.setInterval(save, 5000);
    return () => { window.clearInterval(timer); save(); };
  }, [file.id, src, refresh]);

  useEffect(() => {
    if (video.current) video.current.volume = volume;
  }, [volume, src]);

  async function search(language: string) {
    try {
      const results = await window.streamlocal.subtitles.search(file.type === "episode" ? `${file.series} S${file.season}E${file.episode}` : file.title, language);
      setSubs(results);
      setMessage(results.length ? `Choose one of the ${results.length} subtitle matches.` : "No matching subtitles were found.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Subtitle search failed.");
    }
  }

  function choosePreferred(language: "he" | "en") {
    const url = preferred[language];
    if (url) {
      setMessage(`Loading ${language === "he" ? "Hebrew" : "English"} subtitles…`);
      setSubtitleUrl(url);
    } else {
      void search(language);
      setSubtitleOpen(true);
    }
  }

  function mark(kind: "seen" | "heard") {
    const now = video.current?.currentTime;
    if (now == null || !subtitleUrl) return setMessage("Choose subtitles first.");
    if (kind === "seen") {
      setSeenAt(now);
      if (heardAt == null) return setMessage("Subtitle marked. Press I HEAR NOW when you hear the same line.");
      sync(now, heardAt);
      return;
    }
    setHeardAt(now);
    if (seenAt == null) return setMessage("Audio marked. Press I SEE NOW when you see the same line.");
    sync(seenAt, now);
  }

  function sync(subtitleTime: number, audioTime: number) {
    const cues = track.current?.track.cues;
    if (!cues) return setMessage("Subtitle track is still loading. Try again in a moment.");
    const offset = audioTime - subtitleTime;
    for (const cue of Array.from(cues)) {
      cue.startTime = Math.max(0, cue.startTime + offset);
      cue.endTime = Math.max(cue.startTime + .05, cue.endTime + offset);
    }
    setSeenAt(null);
    setHeardAt(null);
    setMessage(`Subtitles synchronized by ${offset >= 0 ? "+" : ""}${offset.toFixed(2)} seconds.`);
  }

  function togglePlay() {
    const element = video.current;
    if (!element) return;
    if (element.paused) void element.play(); else element.pause();
  }

  function seekBy(amount: number) {
    if (video.current) video.current.currentTime = Math.max(0, Math.min(video.current.duration || Infinity, video.current.currentTime + amount));
  }

  function formatTime(seconds: number) {
    const total = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function toggleFullscreen() {
    const element = video.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen(); else void element.requestFullscreen();
  }

  return <div className="player">
    <div className="player-toolbar" aria-label="Player controls">
      <div className="player-title"><p className="eyebrow">NOW PLAYING</p><strong>{title(file)}</strong></div>
      <div className="player-actions">
        <button onClick={() => choosePreferred("he")}>HEBREW</button>
        <button onClick={() => choosePreferred("en")}>ENGLISH</button>
        <label className="brightness">Brightness <input type="range" min="50" max="150" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /></label>
        <label className="speed">Speed <select value={rate} onChange={(event) => { const nextRate = Number(event.target.value); setRate(nextRate); if (video.current) video.current.playbackRate = nextRate; }}><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
        <button aria-expanded={moreOpen} aria-controls="player-more-options" aria-label="More player options" onClick={() => setMoreOpen(!moreOpen)}>⋯</button>
        <button className="close" aria-label="Close player" title="Close player (Esc)" onClick={close}>×</button>
      </div>
      {moreOpen && <div id="player-more-options" className="player-menu">
        <strong>Subtitle synchronization</strong>
        <p>Pause on one line, then mark when you see and hear it.</p>
        <div><button onClick={() => mark("seen")}>{seenAt == null ? "I SEE NOW" : "SUBTITLE MARKED"}</button><button onClick={() => mark("heard")}>{heardAt == null ? "I HEAR NOW" : "AUDIO MARKED"}</button></div>
        <button className="more-subtitles" onClick={() => setSubtitleOpen(!subtitleOpen)} aria-expanded={subtitleOpen}>More subtitles</button>
      </div>}
    </div>
    <div className="player-video">
      {src && <video ref={video} src={src} style={{ filter: `brightness(${brightness}%)` }} autoPlay muted={muted} onPlay={() => setPlaying(true)} onPause={() => {
        const element = video.current;
        if (element) void window.streamlocal.history.saveProgress(file.id, element.currentTime, element.duration || 0).then(refresh);
        setPlaying(false);
      }} onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)} onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); event.currentTarget.currentTime = initial; event.currentTarget.playbackRate = rate; }}>
        {subtitleUrl && <track key={subtitleUrl} ref={track} kind="subtitles" src={subtitleUrl} default onLoad={(event) => { event.currentTarget.track.mode = "showing"; setMessage("Subtitles loaded and enabled."); }} onError={() => setMessage("The selected subtitle file could not be loaded.")} />}
      </video>}
      <div className="netflix-controls" aria-label="Video controls">
        <label className="sr-only" htmlFor="player-seek">Playback position</label>
        <input id="player-seek" className="player-seek" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(position, duration || 0)} onChange={(event) => { const next = Number(event.target.value); setPosition(next); if (video.current) video.current.currentTime = next; }} />
        <div className="control-row">
          <div className="control-group">
            <button aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>{playing ? "❚❚" : "▶"}</button>
            <button aria-label="Rewind 10 seconds" onClick={() => seekBy(-10)}>↶10</button>
            <button aria-label="Forward 10 seconds" onClick={() => seekBy(10)}>10↷</button>
            <button aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted(!muted)}>{muted ? "🔇" : "🔊"}</button>
            <label className="volume-control"><span className="sr-only">Volume</span><input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={(event) => { setVolume(Number(event.target.value)); setMuted(false); }} /></label>
            <span className="timecode">{formatTime(position)} / {formatTime(duration)}</span>
          </div>
          <div className="control-group">
            <button aria-label="Subtitle and audio options" onClick={() => setMoreOpen(!moreOpen)}>CC</button>
            <button aria-label="Playback speed" onClick={() => setMoreOpen(!moreOpen)}>{rate}×</button>
            <button aria-label="Fullscreen" onClick={toggleFullscreen}>⛶</button>
          </div>
        </div>
      </div>
    </div>
    {subtitleOpen && <section className="subtitle subtitle-drawer" aria-labelledby="subtitle-drawer-title">
      <div className="subtitle-drawer-head"><div><h3 id="subtitle-drawer-title">More subtitles</h3><p>Select a subtitle track or search the available results.</p></div><button className="subtitle-close" aria-label="Close subtitle list" onClick={() => setSubtitleOpen(false)}>×</button></div>
      <label className="subtitle-search">Filter subtitles<input value={subtitleQuery} onChange={(event) => setSubtitleQuery(event.target.value)} placeholder="Search release or language" /></label>
      <div className="subtitle-languages"><button onClick={() => void search("he")}>Search Hebrew</button><button onClick={() => void search("en")}>Search English</button></div>
      {!subs.length && <p className="subtitle-empty" role="status">No subtitle results yet. Choose a language to search.</p>}
      {!!subs.length && !subs.some((item) => (item.release || item.fileName || item.language).toLowerCase().includes(subtitleQuery.toLowerCase())) && <p className="subtitle-empty" role="status">No subtitles match this filter.</p>}
      {subs.filter((item) => (item.release || item.fileName || item.language).toLowerCase().includes(subtitleQuery.toLowerCase())).slice(0, 8).map((item) => <button className="subtitle-result" key={item.id} onClick={async () => {
        try { setMessage("Loading subtitles…"); setSubtitleUrl(await window.streamlocal.subtitles.download(item.id)); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Download failed."); }
      }}><b>{item.language.toUpperCase()}</b><span>{item.release || item.fileName}</span><small>{item.downloadCount} downloads</small></button>)}
    </section>}
    {message && <p className="notice" role="status" aria-live="polite">{message}</p>}
  </div>;
}
