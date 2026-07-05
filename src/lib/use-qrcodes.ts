import { useCallback, useEffect, useState } from "react";
import { api, type QRDTO, type QRInput } from "@/lib/api";
import { generateId } from "@/lib/crypto";
import { CONFIG } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { useCrypto } from "@/lib/crypto-context";

/** Rascunho com payload em texto puro (antes da cifragem). */
export interface QRDraft {
  id?: string;
  type: "static" | "dynamic";
  kind: string;
  title: string;
  tags: string[];
  payload: string;
  styling: Record<string, unknown>;
  passwordHash?: string | null;
  expiresAt?: string | null;
}

/** QR code com payload já legível (decifrado p/ estáticos; texto puro p/ dinâmicos). */
export interface DecryptedQR extends Omit<QRDTO, "payload"> {
  payload: string;
  decryptError?: boolean;
}

/** URL curta que um QR dinâmico codifica (e que o Worker redireciona). */
export function dynamicRedirectUrl(id: string): string {
  return `${CONFIG.WORKER_URL}/r/${id}`;
}

/** String que deve ser codificada na imagem do QR. */
export function qrEncodedString(qr: { type: string; id: string; payload: string }): string {
  return qr.type === "dynamic" ? dynamicRedirectUrl(qr.id) : qr.payload;
}

export function useQRCodes() {
  const { token } = useAuth();
  const { status: cryptoStatus, encrypt, decrypt } = useCrypto();
  const [qrcodes, setQrcodes] = useState<DecryptedQR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ready = !!token && cryptoStatus === "unlocked";

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { qrcodes: rows } = await api.listQRCodes(token);
      const decrypted: DecryptedQR[] = await Promise.all(
        rows.map(async (r): Promise<DecryptedQR> => {
          // Dinâmicos guardam o destino em texto puro (necessário pro redirect).
          if (r.type === "dynamic") return { ...r, payload: r.payload };
          try {
            if (cryptoStatus !== "unlocked") return { ...r, payload: "", decryptError: true };
            const payload = await decrypt(r.payload);
            return { ...r, payload };
          } catch {
            return { ...r, payload: "", decryptError: true };
          }
        }),
      );
      setQrcodes(decrypted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar QR codes.");
    } finally {
      setLoading(false);
    }
  }, [token, cryptoStatus, decrypt]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  /** Cifra o payload se for estático; dinâmico fica em texto puro. */
  const prepareInput = useCallback(
    async (draft: QRDraft): Promise<{ id: string; input: QRInput }> => {
      if (!token) throw new Error("not_authenticated");
      const id = draft.id || generateId();
      const isDynamic = draft.type === "dynamic";
      const storedPayload = isDynamic ? draft.payload : await encrypt(draft.payload);
      return {
        id,
        input: {
          id,
          type: draft.type,
          kind: draft.kind,
          title: draft.title,
          tags: draft.tags,
          payload: storedPayload,
          styling: draft.styling,
          passwordHash: draft.passwordHash ?? null,
          expiresAt: draft.expiresAt ?? null,
        },
      };
    },
    [token, encrypt],
  );

  const create = useCallback(
    async (draft: QRDraft): Promise<string> => {
      const { id, input } = await prepareInput(draft);
      await api.createQRCode(token!, input);
      await refresh();
      return id;
    },
    [token, prepareInput, refresh],
  );

  const update = useCallback(
    async (id: string, draft: QRDraft): Promise<void> => {
      const { input } = await prepareInput({ ...draft, id });
      await api.updateQRCode(token!, id, input);
      await refresh();
    },
    [token, prepareInput, refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (!token) throw new Error("not_authenticated");
      await api.deleteQRCode(token, id);
      await refresh();
    },
    [token, refresh],
  );

  return { qrcodes, loading, error, refresh, create, update, remove, ready };
}
