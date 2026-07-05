import { Plus, QrCode as QrCodeIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "react-router-dom";

export function Dashboard() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seus QR codes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie, crie e acompanhe seus QR codes.
          </p>
        </div>
        <Button asChild>
          <Link to="/generator">
            <Plus className="h-4 w-4" />
            Novo QR code
          </Link>
        </Button>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar por título, tag, tipo..."
          className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Card className="border-dashed">
        <CardHeader className="items-center text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <QrCodeIcon className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg">Nenhum QR code ainda</CardTitle>
          <CardDescription>
            Crie seu primeiro QR code para começar. Busca, filtros e tags
            chegarão nas próximas fases.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to="/generator">
              <Plus className="h-4 w-4" />
              Criar QR code
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
