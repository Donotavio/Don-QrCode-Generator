import { Moon, QrCode, Sun } from "lucide-react";
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

export function AppShell({ children }: { children: ReactNode }) {
  const { resolvedTheme, toggle } = useTheme();
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 font-semibold"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <QrCode className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">Don QR Code</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
