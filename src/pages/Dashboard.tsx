import {
  Copy,
  Pencil,
  Plus,
  QrCode as QrCodeIcon,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { useAuth } from "@/lib/auth";
import { KIND_LABELS, type QRKind } from "@/lib/qr-builder";
import { useQRCodes } from "@/lib/use-qrcodes";

type SortKey = "recent" | "oldest" | "az";
type TypeFilter = "all" | "static" | "dynamic";

const KINDS = Object.keys(KIND_LABELS) as QRKind[];

export function Dashboard() {
  const { user } = useAuth();
  const { qrcodes, loading, error, create, remove } = useQRCodes();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<QRKind | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [tag, setTag] = useState<string | "all">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    qrcodes.forEach((q) => q.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [qrcodes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = qrcodes.filter((qr) => {
      if (kind !== "all" && qr.kind !== kind) return false;
      if (typeFilter !== "all" && qr.type !== typeFilter) return false;
      if (tag !== "all" && !qr.tags.includes(tag)) return false;
      if (q) {
        const hay = [qr.title, qr.kind, qr.type, ...qr.tags]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title, "pt-BR");
      if (sort === "oldest")
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return out;
  }, [qrcodes, query, kind, typeFilter, tag, sort]);

  const stats = useMemo(() => {
    const total = qrcodes.length;
    const statik = qrcodes.filter((q) => q.type === "static").length;
    const dynamic = qrcodes.filter((q) => q.type === "dynamic").length;
    return { total, statik, dynamic };
  }, [qrcodes]);

  const onDelete = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    await remove(id);
  };

  const duplicate = async (qr: (typeof qrcodes)[number]) => {
    const id = await create({
      type: qr.type,
      kind: qr.kind,
      title: `${qr.title} (cópia)`,
      tags: qr.tags,
      payload: qr.payload,
      styling: qr.styling,
    });
    navigate(`/q/${id}`);
  };

  const hasFilters = query || kind !== "all" || typeFilter !== "all" || tag !== "all";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Olá{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats.total > 0
              ? `${stats.total} QR code${stats.total > 1 ? "s" : ""} · ${stats.statik} estático${stats.statik > 1 ? "s" : ""} · ${stats.dynamic} dinâmico${stats.dynamic > 1 ? "s" : ""}`
              : "Gerencie seus QR codes — conteúdo cifrado ponta-a-ponta."}
          </p>
        </div>
        <Button asChild>
          <Link to="/generator">
            <Plus className="h-4 w-4" />
            Novo QR code
          </Link>
        </Button>
      </header>

      {/* Busca + filtros */}
      <div className="space-y-3">
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
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as QRKind | "all")}
            className="h-9 w-auto text-xs"
          >
            <option value="all">Todos os tipos</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </Select>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="h-9 w-auto text-xs"
          >
            <option value="all">Estático + Dinâmico</option>
            <option value="static">Estáticos</option>
            <option value="dynamic">Dinâmicos</option>
          </Select>
          <Select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="h-9 w-auto text-xs"
            disabled={allTags.length === 0}
          >
            <option value="all">Todas as tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="ml-auto h-9 w-auto text-xs"
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="az">A–Z</option>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setQuery("");
                setKind("all");
                setTypeFilter("all");
                setTag("all");
              }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <QrCodeIcon className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">
              {qrcodes.length === 0 ? "Nenhum QR code ainda" : "Nenhum resultado"}
            </CardTitle>
            <CardDescription>
              {qrcodes.length === 0
                ? "Crie seu primeiro QR code para começar."
                : "Ajuste os filtros ou a busca."}
            </CardDescription>
          </CardHeader>
          {qrcodes.length === 0 && (
            <CardContent className="flex justify-center">
              <Button asChild>
                <Link to="/generator">
                  <Plus className="h-4 w-4" />
                  Criar QR code
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((qr) => (
            <Card
              key={qr.id}
              className="group flex cursor-pointer flex-col transition-shadow hover:shadow-md"
              onClick={() => navigate(`/q/${qr.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">
                    {qr.title}
                  </CardTitle>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                      qr.type === "dynamic"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {qr.type === "dynamic" ? "Dinâmico" : "Estático"}
                  </span>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span>{KIND_LABELS[qr.kind as QRKind] ?? qr.kind}</span>
                  {qr.tags.length > 0 && (
                    <span className="truncate text-xs">
                      · {qr.tags.map((t) => `#${t}`).join(" ")}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-2 pt-0">
                <p className="truncate text-xs text-muted-foreground">
                  {qr.decryptError ? "Falha ao decifrar" : qr.payload || "—"}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(qr.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                    <IconBtn
                      title="Editar"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/generator/${qr.id}`);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      title="Duplicar"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicate(qr);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn
                      title="Excluir"
                      danger={confirmId === qr.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(qr.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
                {confirmId === qr.id && (
                  <p className="text-center text-[11px] text-destructive">
                    Clique novamente no 🗑 para confirmar
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  title,
  danger,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent ${
        danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
