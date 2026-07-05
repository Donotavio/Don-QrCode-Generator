import { ArrowLeft, Download, Loader2, Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Field, Input, Select } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { useQRCodes } from "@/lib/use-qrcodes";
import {
  DEFAULT_STYLE,
  KIND_LABELS,
  formatPayload,
  type PayloadData,
  type QRKind,
  type QrStyleConfig,
} from "@/lib/qr-builder";
import type { QRType } from "@/lib/types";

const KINDS = Object.keys(KIND_LABELS) as QRKind[];

export function Generator() {
  const navigate = useNavigate();
  const { create } = useQRCodes();
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

  const data = dataByKind[kind];
  const payloadString = useMemo(
    () => formatPayload(kind, data),
    [kind, data],
  );

  const canSave = title.trim().length > 0 && payloadString.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const id = await create({
        type: qrType,
        kind,
        title: title.trim(),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        payload: payloadString,
        styling: style as unknown as Record<string, unknown>,
      });
      navigate(`/q/${id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar.");
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Novo QR code</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        {/* Formulário */}
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
                    value={kind}
                    onChange={(e) => setKind(e.target.value as QRKind)}
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
                  hint="Dinâmico = URL curta (redirecionável). Em breve."
                >
                  <Select
                    value={qrType}
                    onChange={(e) => setQrType(e.target.value as QRType)}
                  >
                    <option value="static">Estático</option>
                    <option value="dynamic" disabled>
                      Dinâmico (em breve)
                    </option>
                  </Select>
                </Field>
              </div>
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
                    <PayloadFields
                      kind={kind}
                      data={data}
                      onChange={(next) =>
                        setDataByKind((prev) => ({ ...prev, [kind]: next }))
                      }
                    />
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
                <QrPreview ref={qrRef} data={payloadString} style={style} size={240} />
              </div>

              {payloadString && (
                <details className="rounded-md border p-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Conteúdo codificado
                  </summary>
                  <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">
                    {payloadString}
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
                  <Download className="h-3.5 w-3.5" /> PDF
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
                    <Save className="h-4 w-4" /> Salvar QR code
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
