import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  ["Home", "/"],
  ["Movies", "/movies"],
  ["Series", "/series"],
  ["Watchlist", "/watchlist"],
  ["Favorites", "/favorites"],
  ["Library", "/library"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="StreamLocal home">
          <span className="brand-mark">SL</span>
          <span>StreamLocal</span>
        </NavLink>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(([label, path]) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              end={path === "/"}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <NavLink to="/settings" className="settings-link">
          Settings
        </NavLink>
      </header>

      <main>{children}</main>
    </div>
  );
}
