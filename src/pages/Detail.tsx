import { ArrowLeft, Copy, Download, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QrPreview, type QrPreviewHandle } from "@/components/QrPreview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQRCodes, qrEncodedString } from "@/lib/use-qrcodes";
import { DEFAULT_STYLE, KIND_LABELS, type QrStyleConfig } from "@/lib/qr-builder";

export function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { qrcodes, loading, remove } = useQRCodes();
  const qrRef = useRef<QrPreviewHandle>(null);
  const [confirming, setConfirming] = useState(false);

  const qr = qrcodes.find((q) => q.id === id);

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
    navigator.clipboard?.writeText(qr.payload).catch(() => {});
  };

  const onDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await remove(qr.id);
    navigate("/dashboard");
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
    </div>
  );
}
