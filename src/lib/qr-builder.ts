import type { DotStyle, ErrorCorrection } from "@/lib/types";

/** Tipos de payload suportados. */
export type QRKind =
  | "url"
  | "text"
  | "vcard"
  | "wifi"
  | "email"
  | "sms"
  | "event";

/** Configuração visual do QR. Persistida (cifrada via payload). */
export interface QrStyleConfig {
  ec: ErrorCorrection;
  fg: string;
  bg: string;
  dotStyle: DotStyle;
  eyeSquareStyle: "square" | "extra-rounded" | "dot";
  eyeDotStyle: "square" | "dot";
  logo: string | null;
  margin: number;
}

export const DEFAULT_STYLE: QrStyleConfig = {
  ec: "Q",
  fg: "#0f172a",
  bg: "#ffffff",
  dotStyle: "rounded",
  eyeSquareStyle: "extra-rounded",
  eyeDotStyle: "dot",
  logo: null,
  margin: 8,
};

// ---------- dados de cada tipo ----------

export interface UrlData {
  url: string;
}
export interface TextData {
  text: string;
}
export interface VCardData {
  firstName: string;
  lastName: string;
  org?: string;
  phone?: string;
  email?: string;
  url?: string;
  note?: string;
}
export interface WifiData {
  ssid: string;
  password: string;
  encryption: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}
export interface EmailData {
  to: string;
  subject?: string;
  body?: string;
}
export interface SmsData {
  number: string;
  message?: string;
}
export interface EventData {
  title: string;
  location?: string;
  start: string; // datetime-local
  end: string; // datetime-local
  description?: string;
}

export type PayloadData =
  | UrlData
  | TextData
  | VCardData
  | WifiData
  | EmailData
  | SmsData
  | EventData;

// ---------- formatters ----------

/** Escapa caracteres especiais do formato WIFI:. */
function escapeWifi(v: string): string {
  return v.replace(/([\\;,:"])/g, "\\$1");
}

/** Converte um valor datetime-local (yyyy-MM-ddTHH:mm) em yyyymmddThhmmss (local). */
function fmtIcalDate(dtLocal: string): string {
  if (!dtLocal) return "";
  const d = new Date(dtLocal);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `T${p(d.getHours())}${p(d.getMinutes())}00`
  );
}

function fmtVCard(d: VCardData): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  if (d.lastName || d.firstName) {
    lines.push(`N:${d.lastName};${d.firstName};;;`);
  }
  lines.push(`FN:${[d.firstName, d.lastName].filter(Boolean).join(" ")}`);
  if (d.org) lines.push(`ORG:${d.org}`);
  if (d.phone) lines.push(`TEL;TYPE=CELL:${d.phone}`);
  if (d.email) lines.push(`EMAIL:${d.email}`);
  if (d.url) lines.push(`URL:${d.url}`);
  if (d.note) lines.push(`NOTE:${d.note}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

function fmtEvent(d: EventData): string {
  const lines = ["BEGIN:VEVENT", `SUMMARY:${d.title}`];
  if (d.location) lines.push(`LOCATION:${d.location}`);
  if (d.start) lines.push(`DTSTART:${fmtIcalDate(d.start)}`);
  if (d.end) lines.push(`DTEND:${fmtIcalDate(d.end)}`);
  if (d.description) lines.push(`DESCRIPTION:${d.description}`);
  lines.push("END:VEVENT");
  return lines.join("\n");
}

/** Converte os dados do tipo em string para codificar no QR. */
export function formatPayload(kind: QRKind, data: PayloadData): string {
  switch (kind) {
    case "url":
      return (data as UrlData).url.trim();
    case "text":
      return (data as TextData).text;
    case "vcard":
      return fmtVCard(data as VCardData);
    case "wifi": {
      const d = data as WifiData;
      return `WIFI:T:${d.encryption};S:${escapeWifi(d.ssid)};P:${escapeWifi(d.password)};${
        d.hidden ? "H:true;" : ""
      };`;
    }
    case "email": {
      const d = data as EmailData;
      const params = new URLSearchParams();
      if (d.subject) params.set("subject", d.subject);
      if (d.body) params.set("body", d.body);
      const q = params.toString();
      return `mailto:${d.to.trim()}${q ? `?${q}` : ""}`;
    }
    case "sms": {
      const d = data as SmsData;
      return d.message
        ? `SMSTO:${d.number}:${d.message}`
        : `SMSTO:${d.number}`;
    }
    case "event":
      return fmtEvent(data as EventData);
  }
}

// ---------- opções do qr-code-styling ----------

export interface QrBuildOptions {
  width: number;
  height: number;
  type: "svg" | "canvas";
  data: string;
  margin?: number;
  qrOptions: { errorCorrectionLevel: ErrorCorrection };
  dotsOptions: { color: string; type: DotStyle };
  backgroundOptions: { color: string };
  cornersSquareOptions: { color: string; type: QrStyleConfig["eyeSquareStyle"] };
  cornersDotOptions: { color: string; type: QrStyleConfig["eyeDotStyle"] };
  image?: string;
  imageOptions: {
    hideBackgroundDots: boolean;
    imageSize: number;
    margin: number;
    crossOrigin: string;
  };
}

/** Monta as opções do qr-code-styling a partir do payload + estilo. */
export function buildQrOptions(
  data: string,
  style: QrStyleConfig,
  size = 256,
): QrBuildOptions {
  const opts: QrBuildOptions = {
    width: size,
    height: size,
    type: "svg",
    data: data || " ",
    margin: style.margin,
    qrOptions: { errorCorrectionLevel: style.ec },
    dotsOptions: { color: style.fg, type: style.dotStyle },
    backgroundOptions: { color: style.bg },
    cornersSquareOptions: { color: style.fg, type: style.eyeSquareStyle },
    cornersDotOptions: { color: style.fg, type: style.eyeDotStyle },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.4,
      margin: 2,
      crossOrigin: "anonymous",
    },
  };
  if (style.logo) opts.image = style.logo;
  return opts;
}

// ---------- rótulos ----------

export const KIND_LABELS: Record<QRKind, string> = {
  url: "Link (URL)",
  text: "Texto livre",
  vcard: "Contato (vCard)",
  wifi: "WiFi",
  email: "E-mail",
  sms: "SMS",
  event: "Evento",
};

export const DOT_STYLE_LABELS: Record<DotStyle, string> = {
  square: "Quadrado",
  dots: "Pontos",
  rounded: "Arredondado",
  "extra-rounded": "Muito arredondado",
  classy: "Elegante",
  "classy-rounded": "Elegante arredondado",
};

export const EC_LABELS: Record<ErrorCorrection, string> = {
  L: "Baixa (~7%)",
  M: "Média (~15%)",
  Q: "Alta (~25%)",
  H: "Máxima (~30%)",
};

// ---------- parse reverso (para modo edição) ----------

/**
 * Tenta reconverter o payload codificado de volta nos campos estruturados.
 * Só é trivial para URL e texto; demais tipos editam via payload bruto.
 */
export function parsePayloadBack(
  kind: QRKind,
  raw: string,
): PayloadData | null {
  switch (kind) {
    case "url":
      return { url: raw };
    case "text":
      return { text: raw };
    default:
      return null;
  }
}
