/**
 * Tipos de domínio do Don QR Code.
 * O modelo completo será preenchido nas próximas fases; aqui ficam as bases.
 */

export type QRType = "static" | "dynamic";

export type QRKind =
  | "url"
  | "text"
  | "vcard"
  | "wifi"
  | "email"
  | "sms"
  | "event";

export type ErrorCorrection = "L" | "M" | "Q" | "H";

export type DotStyle =
  | "square"
  | "dots"
  | "rounded"
  | "extra-rounded"
  | "classy"
  | "classy-rounded";

export interface QRStyling {
  ec: ErrorCorrection;
  fg: string;
  bg: string;
  dotStyle: DotStyle;
  /** Logo embutido como data URL, ou null. */
  logo: string | null;
  margin: number;
}

export interface QRCode {
  id: string;
  type: QRType;
  kind: QRKind;
  title: string;
  tags: string[];
  /**
   * Conteúdo real do QR.
   * Quando a criptografia estiver ativa, este campo é armazenado cifrado
   * (AES-GCM) no repo e só é legível com a passphrase mestra.
   */
  payload: string;
  styling: QRStyling;
  /** PBKDF2 hash se este QR exige senha para ser visualizado (escaneado). */
  passwordHash: string | null;
  /** ISO date; QRs dinâmicos expiram após esta data. */
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Soft delete: QRs dinâmicos retornam 410 quando preenchido. */
  deletedAt: string | null;
}

export interface QRDatabase {
  version: number;
  /** Username GitHub autorizado a acessar o painel. */
  owner: string;
  /** Salt (base64) usado para derivar a chave de criptografia. */
  kdfSalt: string | null;
  /** Verificador da passphrase mestra (PBKDF2). */
  kdfVerifier: string | null;
  qrcodes: QRCode[];
}
