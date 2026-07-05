/**
 * Criptografia client-side com AES-GCM (Web Crypto).
 *
 * A chave é derivada da passphrase mestra via PBKDF2 (SHA-256, 600k iterações),
 * mantida apenas em memória (chave não-extraível) e nunca enviada ao Worker.
 * O Worker armazena apenas o ciphertext — nunca vê o conteúdo real.
 *
 * Formato do payload cifrado armazenado: `${ivBase64}:${ctBase64}`
 */

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VERIFIER_PLAINTEXT = "don-qr-valid";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Cast para BufferSource (workaround TS 5.7+ para Web Crypto). */
function bs(buf: Uint8Array): BufferSource {
  return buf as BufferSource;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Gera um salt aleatório (base64). */
export function generateSalt(): string {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  return toBase64(salt);
}

/** Deriva uma chave AES-GCM (não-extraível) a partir da passphrase + salt. */
export async function deriveKey(
  passphrase: string,
  saltBase64: string,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    bs(enc.encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: bs(fromBase64(saltBase64)),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Cifra um texto com AES-GCM. Retorna "iv:ct" em base64. */
export async function encryptText(
  key: CryptoKey,
  plaintext: string,
): Promise<string> {
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: bs(iv) },
    key,
    bs(enc.encode(plaintext)),
  );
  return `${toBase64(iv)}:${toBase64(new Uint8Array(ct))}`;
}

/** Decifra um texto no formato "iv:ct". */
export async function decryptText(
  key: CryptoKey,
  stored: string,
): Promise<string> {
  const [ivB64, ctB64] = stored.split(":");
  if (!ivB64 || !ctB64) throw new Error("invalid_ciphertext");
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bs(fromBase64(ivB64)) },
    key,
    bs(fromBase64(ctB64)),
  );
  return dec.decode(pt);
}

/** Cria um verifier (cifra de um token conhecido) para checar a passphrase. */
export async function makeVerifier(key: CryptoKey): Promise<string> {
  return encryptText(key, VERIFIER_PLAINTEXT);
}

/** Verifica se a chave destrava o verifier correto. */
export async function checkVerifier(
  key: CryptoKey,
  verifier: string,
): Promise<boolean> {
  try {
    return (await decryptText(key, verifier)) === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

/** Gera um id curto e único para QR codes (8 chars alfanuméricos). */
export function generateId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return toBase64(bytes)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toLowerCase();
}

/** Hash de senha (PBKDF2) para QR codes protegidos por senha (Fase 7). */
export async function hashPassword(
  password: string,
): Promise<string> {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    bs(enc.encode(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: bs(salt), iterations: 100_000, hash: "SHA-256" },
    baseKey,
    256,
  );
  return `pbkdf2$100000$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}
