import { QrCode } from "lucide-react";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function Login() {
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
          <Button className="w-full" size="lg" disabled>
            <GithubIcon className="h-5 w-5" />
            Entrar com GitHub
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Acesso restrito. O login via GitHub estará disponível na Fase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
