import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Dashboard } from "@/pages/Dashboard";
import { Detail } from "@/pages/Detail";
import { Generator } from "@/pages/Generator";
import { Login } from "@/pages/Login";
import { NotFound } from "@/pages/NotFound";

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Fluxo público */}
        <Route path="/login" element={<Login />} />

        {/* Fluxo autenticado */}
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/generator"
          element={
            <Protected>
              <Generator />
            </Protected>
          }
        />
        <Route
          path="/q/:id"
          element={
            <Protected>
              <Detail />
            </Protected>
          }
        />

        {/* Defaults */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Protected><NotFound /></Protected>} />
      </Routes>
    </HashRouter>
  );
}
