import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db/streamlocalDb";
import {
  createVault,
  lockVault,
  readSecret,
  saveSecret,
  unlockVault,
  vaultExists,
} from "./secretVault";

describe("encrypted secret vault", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    lockVault();
  });

  it("encrypts a secret at rest and decrypts it after unlock", async () => {
    await createVault("correct horse battery staple");
    await saveSecret("tmdbApiKey", "super-secret-api-key");

    const stored = await db.settings.get("encryptedSecretVault");
    expect(JSON.stringify(stored?.value)).not.toContain("super-secret-api-key");

    lockVault();
    await expect(readSecret("tmdbApiKey")).rejects.toThrow();

    await unlockVault("correct horse battery staple");
    await expect(readSecret("tmdbApiKey")).resolves.toBe("super-secret-api-key");
  });

  it("rejects an incorrect vault password", async () => {
    await createVault("correct horse battery staple");
    lockVault();
    await expect(unlockVault("wrong password")).rejects.toThrow("Invalid vault password");
  });

  it("persists the encrypted vault envelope", async () => {
    await createVault("correct horse battery staple");
    expect(await vaultExists()).toBe(true);
  });
});
