import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { RecognitionPage } from "./pages/RecognitionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/movies" element={<PlaceholderPage title="Movies" stage="STAGE 4" description="The browse experience arrives in Stage 4." />} />
        <Route path="/series" element={<PlaceholderPage title="Series" stage="STAGE 4" description="The browse experience arrives in Stage 4." />} />
        <Route path="/identify" element={<RecognitionPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
