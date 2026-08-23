import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  ["Home", "/"],
  ["Movies", "/movies"],
  ["Series", "/series"],
  ["Identify", "/identify"],
  ["Library", "/library"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" end>
          <span className="brand-mark">SL</span>
          <span>StreamLocal</span>
        </NavLink>
        <nav className="main-nav">
          {navItems.map(([label, path]) => (
            <NavLink key={path} to={path} end={path === "/"} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/settings" className="settings-link">Settings</NavLink>
      </header>
      <main>{children}</main>
    </div>
  );
}
