import { ArrowLeft, Code, Info, Loader2, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PayloadFields, initialData } from "@/components/PayloadFields";
import { QrPreview, type QrPreviewHandle } from "@/components/QrPreview";
import { StyleControls } from "@/components/StyleControls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { generateId, hashPassword } from "@/lib/crypto";
import { useQRCodes, dynamicRedirectUrl } from "@/lib/use-qrcodes";
import {
  DEFAULT_STYLE,
  KIND_LABELS,
  formatPayload,
  parsePayloadBack,
  type PayloadData,
  type QRKind,
  type QrStyleConfig,
} from "@/lib/qr-builder";
import type { QRType } from "@/lib/types";

const KINDS = Object.keys(KIND_LABELS) as QRKind[];

export function Generator() {
  const { id } = useParams();
  const editId = id && id.length > 0 ? id : null;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { qrcodes, create, update } = useQRCodes();
  const qrRef = useRef<QrPreviewHandle>(null);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<QRKind>("url");
  const [dataByKind, setDataByKind] = useState<Record<QRKind, PayloadData>>(
    () =>
      Object.fromEntries(KINDS.map((k) => [k, initialData(k)])) as Record<
        QRKind,
        PayloadData
      >,
  );
  const [tags, setTags] = useState("");
  const [qrType, setQrType] = useState<QRType>("static");
  const [style, setStyle] = useState<QrStyleConfig>(DEFAULT_STYLE);
  const [tab, setTab] = useState("conteudo");
  const [saving, setSaving] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [rawPayload, setRawPayload] = useState("");
  const [loaded, setLoaded] = useState(!editId);
  const [dynamicId, setDynamicId] = useState(() => generateId());
  const [expiresAt, setExpiresAt] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [existingPasswordHash, setExistingPasswordHash] = useState<string | null>(null);

  // Carrega QR existente em modo edição.
  useEffect(() => {
    if (!editId) return;
    const qr = qrcodes.find((q) => q.id === editId);
    if (!qr) {
      // ainda carregando a lista
      return;
    }
    setTitle(qr.title);
    setKind(qr.kind as QRKind);
    setTags(qr.tags.join(", "));
    setQrType(qr.type);
    setStyle({ ...DEFAULT_STYLE, ...(qr.styling as Partial<QrStyleConfig>) });
    if (qr.type === "dynamic") {
      setDynamicId(qr.id);
      // destino do redirect (texto puro) → campo de URL
      setDataByKind((prev) => ({ ...prev, url: { url: qr.payload } }));
      setKind("url");
      setRawMode(false);
      setExpiresAt(qr.expiresAt ? qr.expiresAt.slice(0, 16) : "");
      setExistingPasswordHash(qr.passwordHash);
      setHasPassword(false);
      setPassword("");
    } else {
      const parsed = parsePayloadBack(qr.kind as QRKind, qr.payload);
      if (parsed) {
        setDataByKind((prev) => ({ ...prev, [qr.kind]: parsed }));
        setRawMode(false);
      } else {
        setRawPayload(qr.payload);
        setRawMode(true);
      }
    }
    setLoaded(true);
  }, [editId, qrcodes]);

  const data = dataByKind[kind];
  const effectiveKind: QRKind = qrType === "dynamic" ? "url" : kind;
  const payloadString = useMemo(
    () => (rawMode ? rawPayload : formatPayload(effectiveKind, data)),
    [rawMode, rawPayload, effectiveKind, data],
  );
  // QR dinâmico codifica a URL curta de redirect; estático codifica o payload.
  const encodedString =
    qrType === "dynamic" ? dynamicRedirectUrl(dynamicId) : payloadString;

  const canSave = title.trim().length > 0 && payloadString.trim().length > 0;

  const toggleRaw = (next: boolean) => {
    if (next) {
      setRawPayload(payloadString || formatPayload(kind, data));
      setRawMode(true);
    } else {
      const parsed = parsePayloadBack(kind, rawPayload);
      if (parsed) {
        setDataByKind((prev) => ({ ...prev, [kind]: parsed }));
        setRawMode(false);
      } else {
        // não dá pra converter — mantém bruto
        setRawMode(true);
      }
    }
  };

  const onKindChange = (next: QRKind) => {
    setKind(next);
    // ao trocar o tipo fora do modo bruto, mantém o structured
    const parsed = parsePayloadBack(next, payloadString);
    if (parsed) {
      setDataByKind((prev) => ({ ...prev, [next]: parsed }));
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Resolve senha (dinâmico): nova, mantida ou nenhuma.
      let passwordHash: string | null = null;
      if (qrType === "dynamic") {
        if (hasPassword && password) {
          passwordHash = await hashPassword(password);
        } else if (editId && existingPasswordHash) {
          passwordHash = existingPasswordHash;
        }
      }
      const draft = {
        ...(qrType === "dynamic" ? { id: dynamicId } : {}),
        type: qrType,
        kind: effectiveKind,
        title: title.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        payload: payloadString,
        styling: style as unknown as Record<string, unknown>,
        passwordHash,
        expiresAt:
          qrType === "dynamic" && expiresAt
            ? new Date(expiresAt).toISOString()
            : null,
      };
      if (editId) {
        await update(editId, draft);
        toast("QR code atualizado!", "success");
        navigate(`/q/${editId}`);
      } else {
        const newId = await create(draft);
        toast("QR code criado!", "success");
        navigate(`/q/${newId}`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const dataUrl = await qrRef.current?.getPngDataUrl();
    if (!dataUrl) return;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const size = 80;
    const x = (pageW - size) / 2;
    pdf.addImage(dataUrl, "PNG", x, 40, size, size);
    pdf.setFontSize(16);
    pdf.text(title || "QR Code", pageW / 2, 30, { align: "center" });
    pdf.setFontSize(10);
    pdf.setTextColor(120);
    pdf.text(payloadString.slice(0, 80), pageW / 2, 135, { align: "center" });
    pdf.save("qr-code.pdf");
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando QR...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={() => navigate(editId ? `/q/${editId}` : "/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {editId ? "Editar QR code" : "Novo QR code"}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Field label="Título">
                <Input
                  placeholder="Ex.: Cardápio, WiFi da loja, Contato..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo de conteúdo">
                  <Select
                    value={effectiveKind}
                    onChange={(e) => onKindChange(e.target.value as QRKind)}
                    disabled={qrType === "dynamic"}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Tipo do QR"
                  hint="Dinâmico = URL curta redirecionável (editável/exclusão real)."
                >
                  <Select
                    value={qrType}
                    onChange={(e) => setQrType(e.target.value as QRType)}
                  >
                    <option value="static">Estático (imutável)</option>
                    <option value="dynamic">Dinâmico (redirecionável)</option>
                  </Select>
                </Field>
              </div>
              {qrType === "dynamic" && (
                <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="space-y-1">
                      <p className="font-medium text-primary">QR Dinâmico</p>
                      <p className="text-muted-foreground">
                        O QR codifica uma URL curta sua. O destino fica no
                        servidor (texto puro) e pode ser excluído depois — quem
                        escaneia após a exclusão verá "QR inativo". Tipo fixo em
                        URL.
                      </p>
                      <p className="break-all font-mono text-[11px] text-muted-foreground">
                        {dynamicRedirectUrl(dynamicId)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Validade (opcional)"
                      hint="Após esta data, o redirect vira 410."
                    >
                      <Input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                      />
                    </Field>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={hasPassword}
                          onChange={(e) => setHasPassword(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-input"
                        />
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Exigir senha
                      </label>
                      {hasPassword && (
                        <Input
                          type="password"
                          placeholder="Senha de acesso"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      )}
                      {!hasPassword && editId && existingPasswordHash && (
                        <p className="text-[11px] text-muted-foreground">
                          Já tem senha. Marque para trocar.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Tabs
                value={tab}
                onValueChange={setTab}
                tabs={[
                  { value: "conteudo", label: "Conteúdo" },
                  { value: "estilo", label: "Aparência" },
                ]}
              >
                {tab === "conteudo" ? (
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={rawMode}
                        onChange={(e) => toggleRaw(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-input"
                      />
                      <Code className="h-3.5 w-3.5" />
                      Editar payload bruto (avançado)
                    </label>

                    {rawMode ? (
                      <Field
                        label="Payload bruto"
                        hint="O texto exato codificado no QR."
                      >
                        <Textarea
                          rows={6}
                          value={rawPayload}
                          onChange={(e) => setRawPayload(e.target.value)}
                          className="font-mono text-xs"
                        />
                      </Field>
                    ) : (
                      <PayloadFields
                        kind={kind}
                        data={data}
                        onChange={(next) =>
                          setDataByKind((prev) => ({ ...prev, [kind]: next }))
                        }
                      />
                    )}

                    <Field label="Tags" hint="Separadas por vírgula">
                      <Input
                        placeholder="pessoal, trabalho"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                      />
                    </Field>
                  </div>
                ) : (
                  <StyleControls style={style} onChange={setStyle} />
                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Preview fixo */}
        <div>
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="text-base">Pré-visualização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-white p-4">
                <QrPreview ref={qrRef} data={encodedString} style={style} size={240} />
              </div>

              {encodedString && (
                <details className="rounded-md border p-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    {qrType === "dynamic"
                      ? "URL curta codificada no QR"
                      : "Conteúdo codificado"}
                  </summary>
                  <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">
                    {encodedString}
                  </pre>
                </details>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!payloadString}
                  onClick={() => qrRef.current?.download("png")}
                >
                  PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!payloadString}
                  onClick={() => qrRef.current?.download("svg")}
                >
                  SVG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!payloadString}
                  onClick={exportPdf}
                >
                  PDF
                </Button>
              </div>

              <Button
                className="w-full"
                onClick={save}
                disabled={!canSave || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editId ? "Salvar alterações" : "Salvar QR code"}
                  </>
                )}
              </Button>
              {!canSave && (
                <p className="text-center text-xs text-muted-foreground">
                  Dê um título e preencha o conteúdo.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
