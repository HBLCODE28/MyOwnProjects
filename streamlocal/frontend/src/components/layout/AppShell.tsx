import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import "../../styles/appShell.css";
import "../../styles/stage8BrowseAdditions.css";
import { ToastProvider } from "../ui/Toast";

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
  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="streamlocal-nav">
        <NavLink className="streamlocal-brand" to="/">
          <span className="streamlocal-brand-mark">SL</span>
          <span className="streamlocal-brand-name">StreamLocal</span>
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
