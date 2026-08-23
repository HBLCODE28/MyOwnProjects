import { HealthBadge } from "../components/system/HealthBadge";

export function HomePage() {
  return (
    <div className="page home-page">
      <section className="hero-shell">
        <div className="hero-glow" />
        <div className="hero-content">
          <p className="eyebrow">LOCAL LIBRARY. YOUR MACHINE.</p>
          <h1>Your screen, without the cloud.</h1>
          <p className="hero-copy">
            StreamLocal is being built as a private Windows movie and series library
            with local playback, persistent progress and streaming-service navigation.
          </p>

          <div className="hero-actions">
            <button type="button" className="primary-button" disabled>
              Library setup arrives in Stage 2
            </button>
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

      <section className="foundation-grid" aria-label="Stage 1 foundation">
        <article>
          <span className="card-number">01</span>
          <h2>Local first</h2>
          <p>The backend and database live on this Windows machine.</p>
        </article>
        <article>
          <span className="card-number">02</span>
          <h2>Persistent core</h2>
          <p>SQLite and migrations are prepared for the media library stages.</p>
        </article>
        <article>
          <span className="card-number">03</span>
          <h2>Playback ready</h2>
          <p>FFmpeg availability is visible now, while playback arrives later.</p>
        </article>
      </section>
    </div>
  );
}
