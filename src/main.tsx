import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "@/lib/auth";
import { CryptoProvider } from "@/lib/crypto-context";
import { ThemeProvider } from "@/lib/theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <CryptoProvider>
          <App />
        </CryptoProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
