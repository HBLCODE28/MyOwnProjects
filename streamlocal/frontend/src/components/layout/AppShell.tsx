import { useEffect, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import "../../styles/appShell.css";
import "../../styles/stage8BrowseAdditions.css";
import { ToastProvider } from "../ui/Toast";
import { syncConnectedExternalHistories } from "../../services/externalPlaybackHistory";

type Props = {
  children: ReactNode;
};

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/movies", label: "Movies" },
  { to: "/series", label: "Series" },
  { to: "/identify", label: "Identify" },
  { to: "/library", label: "Library" },
  { to: "/settings", label: "Settings" },
];

export function AppShell({ children }: Props) {
  useEffect(() => {
    let active = true;
    const sync = () => {
      if (!active) return;
      void syncConnectedExternalHistories().catch((error) => {
        console.warn("External playback history sync failed:", error);
      });
    };

    const initial = window.setTimeout(sync, 3000);
    const interval = window.setInterval(sync, 10000);
    return () => {
      active = false;
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="streamlocal-nav">
        <NavLink className="streamlocal-brand" to="/" aria-label="StreamLocal home">
          <img
            className="streamlocal-brand-logo"
            src="./icons/icon.svg?v=3"
            alt=""
            aria-hidden="true"
          />
        </NavLink>

        <nav
          className="streamlocal-nav-links"
          aria-label="Main navigation"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive
                  ? "streamlocal-nav-link active"
                  : "streamlocal-nav-link"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        </header>

        <main className="app-main">{children}</main>
      </div>
    </ToastProvider>
  );
}
