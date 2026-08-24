import { db } from "../db/streamlocalDb";

const VAULT_SETTING_KEY = "encryptedSecretVault";
const VAULT_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const VERIFIER_TEXT = "StreamLocal Vault v1";

type EncryptedSecret = {
  iv: string;
  ciphertext: string;
  updatedAt: number;
};

type VaultEnvelope = {
  version: number;
  salt: string;
  verifierIv: string;
  verifierCiphertext: string;
  secrets: Record<string, EncryptedSecret>;
};

let unlockedKey: CryptoKey | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * TypeScript's newer typed-array definitions can expose Uint8Array as
 * Uint8Array<ArrayBufferLike>. Web Crypto requires a BufferSource backed by
 * ArrayBuffer, so copy the bytes into a fresh ArrayBuffer explicitly.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function deriveVaultKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptText(
  key: CryptoKey,
  plaintext: string,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(plaintextBytes),
  );

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

async function decryptText(
  key: CryptoKey,
  encrypted: { iv: string; ciphertext: string },
): Promise<string> {
  const iv = base64ToBytes(encrypted.iv);
  const ciphertext = base64ToBytes(encrypted.ciphertext);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(ciphertext),
  );

  return new TextDecoder().decode(plaintext);
}

async function loadEnvelope(): Promise<VaultEnvelope | null> {
  const setting = await db.settings.get(VAULT_SETTING_KEY);
  return (setting?.value as VaultEnvelope | undefined) ?? null;
}

async function saveEnvelope(envelope: VaultEnvelope): Promise<void> {
  await db.settings.put({
    key: VAULT_SETTING_KEY,
    value: envelope,
  });
}

export async function vaultExists(): Promise<boolean> {
  return (await loadEnvelope()) !== null;
}

export function vaultIsUnlocked(): boolean {
  return unlockedKey !== null;
}

export function lockVault(): void {
  unlockedKey = null;
}

export async function createVault(passphrase: string): Promise<void> {
  if (passphrase.length < 8) {
    throw new Error("Vault password must contain at least 8 characters.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveVaultKey(passphrase, salt);
  const verifier = await encryptText(key, VERIFIER_TEXT);

  await saveEnvelope({
    version: VAULT_VERSION,
    salt: bytesToBase64(salt),
    verifierIv: verifier.iv,
    verifierCiphertext: verifier.ciphertext,
    secrets: {},
  });

  unlockedKey = key;
}

export async function unlockVault(passphrase: string): Promise<void> {
  const envelope = await loadEnvelope();

  if (!envelope) {
    throw new Error("Secret vault has not been created yet.");
  }

  if (envelope.version !== VAULT_VERSION) {
    throw new Error("Unsupported secret vault version.");
  }

  try {
    const key = await deriveVaultKey(
      passphrase,
      base64ToBytes(envelope.salt),
    );

    const verifier = await decryptText(key, {
      iv: envelope.verifierIv,
      ciphertext: envelope.verifierCiphertext,
    });

    if (verifier !== VERIFIER_TEXT) {
      throw new Error("Invalid vault password.");
    }

    unlockedKey = key;
  } catch {
    unlockedKey = null;
    throw new Error("Invalid vault password.");
  }
}

export async function saveSecret(
  id: string,
  value: string,
): Promise<void> {
  const envelope = await loadEnvelope();

  if (!envelope || !unlockedKey) {
    throw new Error("Unlock the secret vault first.");
  }

  const encrypted = await encryptText(unlockedKey, value.trim());

  envelope.secrets[id] = {
    ...encrypted,
    updatedAt: Date.now(),
  };

  await saveEnvelope(envelope);
}

export async function readSecret(id: string): Promise<string | null> {
  const envelope = await loadEnvelope();

  if (!envelope || !unlockedKey) {
    throw new Error("Unlock the secret vault first.");
  }

  const secret = envelope.secrets[id];
  if (!secret) return null;

  return decryptText(unlockedKey, secret);
}

export async function deleteSecret(id: string): Promise<void> {
  const envelope = await loadEnvelope();

  if (!envelope || !unlockedKey) {
    throw new Error("Unlock the secret vault first.");
  }

  delete envelope.secrets[id];
  await saveEnvelope(envelope);
}

export async function listSecretIds(): Promise<string[]> {
  const envelope = await loadEnvelope();
  return envelope ? Object.keys(envelope.secrets) : [];
}

export async function deleteVault(): Promise<void> {
  lockVault();
  await db.settings.delete(VAULT_SETTING_KEY);
}
