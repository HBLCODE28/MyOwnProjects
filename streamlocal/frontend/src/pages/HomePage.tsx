import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="page home-page">
      <section className="hero-shell">
        <div className="hero-glow" />
        <div className="hero-content">
          <p className="eyebrow">LOCAL LIBRARY. YOUR MACHINE.</p>
          <h1>Your local player.</h1>
          <p className="hero-copy">
            StreamLocal runs in your browser, reads only folders you choose, and stores
            your library locally with no server database and no external metadata API.
          </p>

          <div className="hero-actions">
            <Link className="primary-button" to="/library">Open library</Link>
            <span className="health-badge ok">Browser-only</span>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orb orb-a" />
          <div className="orb orb-b" />
          <div className="media-frame">
            <span className="frame-label">STREAMLOCAL</span>
            <span className="frame-time">INDEXEDDB · LOCAL FILES</span>
          </div>
        </div>
      </section>

      <section className="foundation-grid">
        <article><span className="card-number">01</span><h2>No backend</h2><p>No Python, FastAPI or server database is required when using StreamLocal.</p></article>
        <article><span className="card-number">02</span><h2>Private by design</h2><p>Identification uses filenames and folders locally. Nothing is sent to a metadata API.</p></article>
        <article><span className="card-number">03</span><h2>Portable library</h2><p>Export your metadata and artwork, then reconnect media folders on another computer.</p></article>
      </section>
    </div>
  );
}
