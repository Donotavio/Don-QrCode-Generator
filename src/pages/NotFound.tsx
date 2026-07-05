import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-6xl font-bold tracking-tight text-primary">404</p>
      <p className="text-muted-foreground">Página não encontrada.</p>
      <Button asChild>
        <Link to="/dashboard">Voltar ao início</Link>
      </Button>
    </div>
  );
}
