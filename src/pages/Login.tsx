import { AlertCircle, QrCode } from "lucide-react";
import { useEffect } from "react";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authErrorMessage, useAuth } from "@/lib/auth";
import { CONFIG } from "@/lib/config";

export function Login() {
  const { status, error, login } = useAuth();

  // Se por algum motivo voltar autenticado pra cá, manda pro dashboard.
  useEffect(() => {
    if (status === "authenticated") {
      window.location.hash = "#/dashboard";
    }
  }, [status]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-background via-background to-accent/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <QrCode className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Don QR Code</CardTitle>
          <CardDescription>
            Seu gerador pessoal de QR codes, hospedado no GitHub Pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{authErrorMessage(error)}</span>
            </div>
          )}
          <Button className="w-full" size="lg" onClick={login}>
            <GithubIcon className="h-5 w-5" />
            Entrar com GitHub
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Acesso restrito a{" "}
            <span className="font-medium">@{CONFIG.ALLOWED_USERNAME}</span>.
            Autenticação via OAuth + PKCE.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
