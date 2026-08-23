import { Link } from "react-router-dom";
import { HealthBadge } from "../components/system/HealthBadge";

export function HomePage() {
  return (
    <div className="page home-page">
      <section className="hero-shell">
        <div className="hero-glow" />
        <div className="hero-content">
          <p className="eyebrow">LOCAL LIBRARY. YOUR MACHINE.</p>
          <h1>Your local player.</h1>
          <p className="hero-copy">
            StreamLocal is a private Windows movie and series library with local playback,
            persistent progress and streaming-service navigation.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/library">Open library</Link>
            <HealthBadge />
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orb orb-a" />
          <div className="orb orb-b" />
          <div className="media-frame">
            <span className="frame-label">STREAMLOCAL</span>
            <span className="frame-time">LOCALHOST : 4310</span>
          </div>
        </div>
      </section>
      <section className="foundation-grid" aria-label="StreamLocal foundation">
        <article><span className="card-number">01</span><h2>Local first</h2><p>Your media stays on this Windows machine.</p></article>
        <article><span className="card-number">02</span><h2>Persistent library</h2><p>Configured folders and imported file records survive restarts.</p></article>
        <article><span className="card-number">03</span><h2>Playback ready</h2><p>Technical stream data prepares the library for later playback stages.</p></article>
      </section>
    </div>
  );
}
