import { useCallback, useEffect, useState } from "react";
import { api, type QRDTO, type QRInput } from "@/lib/api";
import { generateId } from "@/lib/crypto";
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

/** QR code com payload já decifrado (para exibição). */
export interface DecryptedQR extends Omit<QRDTO, "payload"> {
  payload: string;
  decryptError?: boolean;
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
        rows.map(async (r) => {
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

  const create = useCallback(
    async (draft: QRDraft): Promise<string> => {
      if (!token) throw new Error("not_authenticated");
      const id = draft.id || generateId();
      const ciphertext = await encrypt(draft.payload);
      const input: QRInput = {
        id,
        type: draft.type,
        kind: draft.kind,
        title: draft.title,
        tags: draft.tags,
        payload: ciphertext,
        styling: draft.styling,
        passwordHash: draft.passwordHash ?? null,
        expiresAt: draft.expiresAt ?? null,
      };
      await api.createQRCode(token, input);
      await refresh();
      return id;
    },
    [token, encrypt, refresh],
  );

  const update = useCallback(
    async (id: string, draft: QRDraft): Promise<void> => {
      if (!token) throw new Error("not_authenticated");
      const ciphertext = await encrypt(draft.payload);
      const input: QRInput = {
        id,
        type: draft.type,
        kind: draft.kind,
        title: draft.title,
        tags: draft.tags,
        payload: ciphertext,
        styling: draft.styling,
        passwordHash: draft.passwordHash ?? null,
        expiresAt: draft.expiresAt ?? null,
      };
      await api.updateQRCode(token, id, input);
      await refresh();
    },
    [token, encrypt, refresh],
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
