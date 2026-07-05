import { Loader2, Plus, QrCode as QrCodeIcon, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useQRCodes } from "@/lib/use-qrcodes";
import { Link } from "react-router-dom";

const KIND_LABEL: Record<string, string> = {
  url: "Link",
  text: "Texto",
  vcard: "Contato",
  wifi: "WiFi",
  email: "E-mail",
  sms: "SMS",
  event: "Evento",
};

export function Dashboard() {
  const { user } = useAuth();
  const { qrcodes, loading, error, create, remove } = useQRCodes();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return qrcodes;
    return qrcodes.filter((qr) => {
      const hay = [qr.title, qr.kind, qr.type, ...qr.tags].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [qrcodes, query]);

  // Apenas para validar a Fase 3 (será removido quando o gerador estiver pronto).
  const seedTest = async () => {
    setBusy(true);
    try {
      await create({
        type: "static",
        kind: "url",
        title: `QR de teste ${qrcodes.length + 1}`,
        tags: ["teste"],
        payload: "https://github.com/Donotavio",
        styling: { ec: "H", fg: "#0f172a", bg: "#ffffff", dotStyle: "rounded", logo: null, margin: 4 },
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Olá{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus QR codes — conteúdo cifrado ponta-a-ponta.
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
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título, tag, tipo..."
          className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <QrCodeIcon className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">
              {query ? "Nenhum resultado" : "Nenhum QR code ainda"}
            </CardTitle>
            <CardDescription>
              {query
                ? "Tente outro termo de busca."
                : "Crie seu primeiro QR code, ou plante um de teste pra validar o cofre."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/generator">
                <Plus className="h-4 w-4" />
                Criar QR code
              </Link>
            </Button>
            {!query && (
              <Button variant="outline" onClick={seedTest} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Plantar QR de teste
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((qr) => (
            <Card key={qr.id} className="flex flex-col">
              <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-tight">
                        {qr.title}
                      </CardTitle>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                          qr.type === "dynamic"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {qr.type === "dynamic" ? "Dinâmico" : "Estático"}
                      </span>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <span>{KIND_LABEL[qr.kind] ?? qr.kind}</span>
                      {qr.tags.length > 0 && (
                        <span className="text-xs">· {qr.tags.join(", ")}</span>
                      )}
                    </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-end justify-between gap-2 pt-0">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">
                    {qr.decryptError ? "Falha ao decifrar" : qr.payload || "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(qr.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(qr.id)}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
