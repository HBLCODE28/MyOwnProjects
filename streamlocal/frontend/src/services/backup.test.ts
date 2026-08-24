import { beforeEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { db } from "../db/streamlocalDb";
import { exportStreamLocalBackup } from "./backup";

describe("StreamLocal backup", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("does not export filesystem handles or encrypted API vault", async () => {
    await db.librarySources.add({
      id: "source-1",
      name: "Movies",
      createdAt: 1,
      lastScanAt: null,
      enabled: true,
      recursive: true,
      handle: null,
    });

    await db.settings.add({
      key: "encryptedSecretVault",
      value: { ciphertext: "private-vault-data" },
    });

    const blob = await exportStreamLocalBackup();
    const zipData = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(zipData);
    const libraryFile = zip.file("library.json");
    expect(libraryFile).not.toBeNull();

    const text = await libraryFile!.async("string");
    const json = JSON.parse(text);

    expect(json.librarySources[0].handle).toBeNull();
    expect(text).not.toContain("private-vault-data");
    expect(json.settings.some((setting: { key: string }) => setting.key === "encryptedSecretVault")).toBe(false);
  });
});
