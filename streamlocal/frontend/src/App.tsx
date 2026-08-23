import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { HomePage } from "./pages/HomePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/movies"
          element={
            <PlaceholderPage
              title="Movies"
              stage="STAGE 4"
              description="The movie library UI will be connected after scanning and metadata are implemented."
            />
          }
        />
        <Route
          path="/series"
          element={
            <PlaceholderPage
              title="Series"
              stage="STAGE 4"
              description="Series, seasons and episodes will be added after the library model is available."
            />
          }
        />
        <Route
          path="/watchlist"
          element={
            <PlaceholderPage
              title="Watchlist"
              stage="STAGE 7"
              description="Persistent personal lists will be implemented with watch-state tracking."
            />
          }
        />
        <Route
          path="/favorites"
          element={
            <PlaceholderPage
              title="Favorites"
              stage="STAGE 7"
              description="Favorites will remain separate from the watchlist."
            />
          }
        />
        <Route
          path="/library"
          element={
            <PlaceholderPage
              title="Library"
              stage="STAGE 2"
              description="Persistent media folders and scanning are the next implementation stage."
            />
          }
        />
        <Route
          path="/settings"
          element={
            <PlaceholderPage
              title="Settings"
              stage="STAGE 14"
              description="Runtime configuration is already prepared; the full settings UI comes later."
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
