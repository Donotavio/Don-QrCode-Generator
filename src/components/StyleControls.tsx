import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  DOT_STYLE_LABELS,
  EC_LABELS,
  type QrStyleConfig,
} from "@/lib/qr-builder";
import { resizeImageToDataUrl } from "@/lib/image";
import type { DotStyle, ErrorCorrection } from "@/lib/types";

interface StyleControlsProps {
  style: QrStyleConfig;
  onChange: (next: QrStyleConfig) => void;
}

export function StyleControls({ style, onChange }: StyleControlsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const set = (patch: Partial<QrStyleConfig>) => onChange({ ...style, ...patch });

  const onLogo = async (file: File | null) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      // Redimensiona para no máximo 200px antes de armazenar — evita
      // estourar o limite do D1 com base64 de megabytes.
      const dataUrl = await resizeImageToDataUrl(file, 200);
      set({ logo: dataUrl });
    } catch {
      alert("Não foi possível processar a imagem. Tente um PNG/JPG menor.");
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ColorField
        label="Cor do QR"
        value={style.fg}
        onChange={(v) => set({ fg: v })}
      />
      <ColorField
        label="Fundo"
        value={style.bg}
        onChange={(v) => set({ bg: v })}
      />

      <Field label="Estilo dos pontos">
        <Select
          value={style.dotStyle}
          onChange={(e) => set({ dotStyle: e.target.value as DotStyle })}
        >
          {Object.entries(DOT_STYLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Cantos (quadado externo)">
        <Select
          value={style.eyeSquareStyle}
          onChange={(e) =>
            set({
              eyeSquareStyle: e.target
                .value as QrStyleConfig["eyeSquareStyle"],
            })
          }
        >
          <option value="square">Quadrado</option>
          <option value="extra-rounded">Arredondado</option>
          <option value="dot">Ponto</option>
        </Select>
      </Field>

      <Field label="Cantos (ponto interno)">
        <Select
          value={style.eyeDotStyle}
          onChange={(e) =>
            set({ eyeDotStyle: e.target.value as QrStyleConfig["eyeDotStyle"] })
          }
        >
          <option value="square">Quadrado</option>
          <option value="dot">Ponto</option>
        </Select>
      </Field>

      <Field
        label="Correção de erro"
        hint="Maior = mais resistente a danos, mas mais denso."
      >
        <Select
          value={style.ec}
          onChange={(e) => set({ ec: e.target.value as ErrorCorrection })}
        >
          {Object.entries(EC_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {k} — {v}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Margem (quiet zone)" hint="Recomendado: ≥ 4 módulos.">
        <Input
          type="number"
          min={0}
          max={40}
          value={style.margin}
          onChange={(e) => set({ margin: Number(e.target.value) })}
        />
      </Field>

      <Field label="Logo no centro" className="sm:col-span-2">
        {style.logo ? (
          <div className="flex items-center gap-3">
            <img
              src={style.logo}
              alt="logo"
              className="h-12 w-12 rounded border bg-white object-contain"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set({ logo: null })}
            >
              <X className="h-4 w-4" /> Remover
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={logoBusy}
          >
            <Upload className="h-4 w-4" /> {logoBusy ? "Processando..." : "Enviar imagem"}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          className="hidden"
          onChange={(e) => onLogo(e.target.files?.[0] ?? null)}
        />
      </Field>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
          aria-label={`${label} cor`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono uppercase"
        />
      </div>
    </Field>
  );
}
