import { CONFIG } from "@/lib/config";

/** DTO que vem do Worker (payload ainda cifrado). */
export interface QRDTO {
  id: string;
  type: "static" | "dynamic";
  kind: string;
  title: string;
  tags: string[];
  payload: string;
  styling: Record<string, unknown>;
  passwordHash: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface QRInput {
  id: string;
  type: "static" | "dynamic";
  kind: string;
  title: string;
  tags: string[];
  payload: string; // ciphertext
  styling: Record<string, unknown>;
  passwordHash?: string | null;
  expiresAt?: string | null;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function req<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${CONFIG.WORKER_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new ApiError(
      body.error || "http_error",
      body.message || `Erro ${res.status}`,
      res.status,
    );
  }
  return body as T;
}

export const api = {
  getMeta: (token: string) =>
    req<{ meta: Record<string, string> }>(token, "/api/meta"),

  putMeta: (token: string, key: string, value: string) =>
    req<{ ok: boolean }>(token, "/api/meta", {
      method: "PUT",
      body: JSON.stringify({ key, value }),
    }),

  listQRCodes: (token: string) =>
    req<{ qrcodes: QRDTO[] }>(token, "/api/qrcodes"),

  createQRCode: (token: string, qr: QRInput) =>
    req<{ qrcode: QRDTO }>(token, "/api/qrcodes", {
      method: "POST",
      body: JSON.stringify(qr),
    }),

  updateQRCode: (token: string, id: string, qr: QRInput) =>
    req<{ qrcode: QRDTO }>(token, `/api/qrcodes/${id}`, {
      method: "PUT",
      body: JSON.stringify(qr),
    }),

  deleteQRCode: (token: string, id: string) =>
    req<{ ok: boolean }>(token, `/api/qrcodes/${id}`, {
      method: "DELETE",
    }),

  getStats: (token: string, id: string) =>
    req<{
      total: number;
      recent: { ts: string; ua: string; country: string | null }[];
      lastScan: string | null;
    }>(token, `/api/stats/${id}`),
};
