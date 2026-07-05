import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { Callback } from "@/pages/Callback";
import { Dashboard } from "@/pages/Dashboard";
import { Detail } from "@/pages/Detail";
import { Generator } from "@/pages/Generator";
import { Login } from "@/pages/Login";
import { NotFound } from "@/pages/NotFound";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Fluxo público */}
        <Route path="/login" element={<Login />} />
        <Route path="/callback" element={<Callback />} />

        {/* Fluxo autenticado (guard real chega na Fase 2) */}
        <Route
          path="/dashboard"
          element={
            <AppShell>
              <Dashboard />
            </AppShell>
          }
        />
        <Route
          path="/generator"
          element={
            <AppShell>
              <Generator />
            </AppShell>
          }
        />
        <Route
          path="/q/:id"
          element={
            <AppShell>
              <Detail />
            </AppShell>
          }
        />

        {/* Defaults */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="*"
          element={
            <AppShell>
              <NotFound />
            </AppShell>
          }
        />
      </Routes>
    </HashRouter>
  );
}
