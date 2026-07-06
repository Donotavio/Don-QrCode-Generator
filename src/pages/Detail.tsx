import { ArrowLeft, Clock, Copy, Download, KeyRound, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QrPreview, type QrPreviewHandle } from "@/components/QrPreview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";
import { useQRCodes, qrEncodedString } from "@/lib/use-qrcodes";
import { DEFAULT_STYLE, KIND_LABELS, type QrStyleConfig } from "@/lib/qr-builder";

interface Stats {
  total: number;
  recent: { ts: string; ua: string; country: string | null }[];
  lastScan: string | null;
}

const COUNTRY_FLAGS: Record<string, string> = {
  BR: "🇧🇷", US: "🇺🇸", PT: "🇵🇹", AR: "🇦🇷", GB: "🇬🇧", DE: "🇩🇪", FR: "🇫🇷",
  ES: "🇪🇸", IT: "🇮🇹", JP: "🇯🇵", CN: "🇨🇳", CA: "🇨🇦", MX: "🇲🇽",
};

function flag(country: string | null): string {
  if (!country) return "🌍";
  return COUNTRY_FLAGS[country] ?? country;
}

function relTime(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h atrás`;
  const d = Math.floor(h / 24);
  return `${d} d atrás`;
}

/** Bucket dos últimos 14 dias a partir dos eventos recentes. */
function dailyBuckets(recent: Stats["recent"]): { day: string; label: string; count: number }[] {
  const days: { day: string; label: string; count: number }[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, label: `${d.getDate()}/${d.getMonth() + 1}`, count: 0 });
  }
  const map = new Map(days.map((d) => [d.day, d]));
  for (const ev of recent) {
    const key = ev.ts.slice(0, 10);
    const bucket = map.get(key);
    if (bucket) bucket.count++;
  }
  return days;
}

export function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();
  const { qrcodes, loading, remove } = useQRCodes();
  const qrRef = useRef<QrPreviewHandle>(null);
  const [confirming, setConfirming] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const qr = qrcodes.find((q) => q.id === id);

  useEffect(() => {
    if (!token || !qr || qr.type !== "dynamic") {
      setStats(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    api
      .getStats(token, qr.id)
      .then((s) => {
        if (!cancelled) setStats(s as Stats);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, qr]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold">QR code não encontrado</h1>
        <p className="text-sm text-muted-foreground">
          Ele pode ter sido excluído ou a URL está incorreta.
        </p>
        <Button asChild>
          <Link to="/dashboard">Voltar ao painel</Link>
        </Button>
      </div>
    );
  }

  const style = { ...DEFAULT_STYLE, ...(qr.styling as Partial<QrStyleConfig>) };

  const copy = () => {
    navigator.clipboard?.writeText(qr.payload).then(
      () => toast("Conteúdo copiado!", "success"),
      () => toast("Não foi possível copiar.", "error"),
    );
  };

  const onDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      await remove(qr.id);
      toast("QR code excluído.", "success");
      navigate("/dashboard");
    } catch {
      toast("Erro ao excluir.", "error");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{qr.title}</h1>
            <p className="text-sm text-muted-foreground">
              {KIND_LABELS[qr.kind as keyof typeof KIND_LABELS] ?? qr.kind} ·{" "}
              {qr.type === "dynamic" ? "Dinâmico" : "Estático"} ·{" "}
              {new Date(qr.createdAt).toLocaleDateString("pt-BR")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {qr.passwordHash && (
                <Badge icon={<KeyRound className="h-3 w-3" />} label="Com senha" tone="primary" />
              )}
              {qr.expiresAt && (
                <Badge
                  icon={<Clock className="h-3 w-3" />}
                  label={
                    new Date(qr.expiresAt).getTime() < Date.now()
                      ? `Expirou ${new Date(qr.expiresAt).toLocaleDateString("pt-BR")}`
                      : `Validade ${new Date(qr.expiresAt).toLocaleDateString("pt-BR")}`
                  }
                  tone={
                    qr.expiresAt && new Date(qr.expiresAt).getTime() < Date.now()
                      ? "destructive"
                      : "muted"
                  }
                />
              )}
            </div>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            #{qr.id}
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="flex justify-center pt-6">
            <div className="rounded-lg border bg-white p-4">
              <QrPreview ref={qrRef} data={qrEncodedString(qr)} style={style} size={280} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {qr.type === "dynamic" ? "URL curta (codificada no QR)" : "Conteúdo codificado"}
              </p>
              {qr.type === "dynamic" && (
                <pre className="mb-2 overflow-auto whitespace-pre-wrap break-all rounded-md bg-primary/5 p-2 font-mono text-xs text-primary">
                  {qrEncodedString(qr)}
                </pre>
              )}
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {qr.type === "dynamic" ? "Destino do redirect" : "Conteúdo"}
              </p>
              <div className="flex items-start gap-2">
                <pre className="max-h-32 flex-1 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs">
                  {qr.decryptError ? "Falha ao decifrar" : qr.payload}
                </pre>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={copy}
                  title="Copiar"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {qr.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {qr.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => qrRef.current?.download("png")}
              >
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => qrRef.current?.download("svg")}
              >
                SVG
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => qrRef.current?.download("jpeg")}
              >
                <Download className="h-3.5 w-3.5" /> JPG
              </Button>
            </div>

            <div className="border-t pt-4">
              <Button
                variant={confirming ? "destructive" : "outline"}
                className="w-full"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                {confirming ? "Confirmar exclusão" : "Excluir QR code"}
              </Button>
              {confirming && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Clique novamente para confirmar.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {qr.type === "dynamic" && (
        <AnalyticsCard stats={stats} loading={statsLoading} />
      )}
    </div>
  );
}

function AnalyticsCard({
  stats,
  loading,
}: {
  stats: Stats | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando analytics...
        </CardContent>
      </Card>
    );
  }
  if (!stats) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Analytics indisponível.
        </CardContent>
      </Card>
    );
  }
  const buckets = dailyBuckets(stats.recent);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const topRecent = stats.recent.slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">📊 Analytics de scans</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">scans totais</p>
          </div>
          <div>
            <p className="text-sm font-medium">
              {relTime(stats.lastScan)}
            </p>
            <p className="text-xs text-muted-foreground">último scan</p>
          </div>
        </div>

        {/* barras últimos 14 dias */}
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Últimos 14 dias</p>
          <div className="flex h-20 items-end gap-1">
            {buckets.map((b) => (
              <div
                key={b.day}
                title={`${b.label}: ${b.count}`}
                className="flex-1 rounded-t bg-primary/70 transition-all hover:bg-primary"
                style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 4 : 0 }}
              />
            ))}
          </div>
        </div>

        {/* recentes */}
        {topRecent.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Scans recentes</p>
            <div className="space-y-1">
              {topRecent.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span>{flag(ev.country)}</span>
                    <span className="text-muted-foreground">
                      {ev.country ?? "—"}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(ev.ts).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Badge({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "primary" | "muted" | "destructive";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    muted: "bg-muted text-muted-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${tones[tone]}`}
    >
      {icon}
      {label}
    </span>
  );
}
