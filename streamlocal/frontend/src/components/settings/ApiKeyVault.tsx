import { useEffect, useState } from "react";
import {
  createVault,
  deleteSecret,
  deleteVault,
  listSecretIds,
  lockVault,
  readSecret,
  saveSecret,
  unlockVault,
  vaultExists,
  vaultIsUnlocked,
} from "../../services/secretVault";

type SecretField = {
  id: string;
  label: string;
  help: string;
};

const SECRET_FIELDS: SecretField[] = [
  {
    id: "customMetadataApiKey",
    label: "Custom metadata API key",
    help: "Optional encrypted slot for a future metadata provider that requires a key.",
  },
  {
    id: "customPosterApiKey",
    label: "Custom poster API key",
    help: "Optional encrypted slot for a future artwork provider that requires a key.",
  },
  {
    id: "openSubtitlesApiKey",
    label: "OpenSubtitles API key",
    help: "Used only to search and download subtitles for your local playback.",
  },
];

export function ApiKeyVault() {
  const [exists, setExists] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [storedIds, setStoredIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshState() {
    setExists(await vaultExists());
    setUnlocked(vaultIsUnlocked());
    setStoredIds(await listSecretIds());
  }

  useEffect(() => {
    void refreshState();
  }, []);

  async function create() {
    setMessage(null);
    try {
      await createVault(password);
      setPassword("");
      setMessage(
        "Encrypted API key vault created and unlocked for this session.",
      );
      await refreshState();
    } catch (value) {
      setMessage(
        value instanceof Error
          ? value.message
          : "Vault could not be created.",
      );
    }
  }

  async function unlock() {
    setMessage(null);
    try {
      await unlockVault(password);
      setPassword("");
      setMessage("API key vault unlocked for this browser session.");
      await refreshState();
    } catch (value) {
      setMessage(
        value instanceof Error
          ? value.message
          : "Vault could not be unlocked.",
      );
    }
  }

  async function save(id: string) {
    const value = values[id]?.trim();
    if (!value) {
      setMessage("Enter a value before saving.");
      return;
    }

    try {
      await saveSecret(id, value);
      setValues((current) => ({ ...current, [id]: "" }));
      setMessage("API credential encrypted and saved locally.");
      await refreshState();
    } catch (value) {
      setMessage(
        value instanceof Error
          ? value.message
          : "Credential could not be saved.",
      );
    }
  }

  async function reveal(id: string) {
    try {
      const value = await readSecret(id);
      setValues((current) => ({ ...current, [id]: value ?? "" }));
      setMessage(
        value
          ? "Credential decrypted into the field for this session."
          : "No saved credential.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Credential could not be read.",
      );
    }
  }

  async function remove(id: string) {
    await deleteSecret(id);
    setValues((current) => ({ ...current, [id]: "" }));
    setMessage("Saved credential deleted.");
    await refreshState();
  }

  function lock() {
    lockVault();
    setValues({});
    setUnlocked(false);
    setMessage("API key vault locked.");
  }

  async function removeVault() {
    if (
      !window.confirm(
        "Delete the encrypted API key vault and all saved credentials?",
      )
    ) {
      return;
    }

    await deleteVault();
    setValues({});
    setMessage("Encrypted API key vault deleted.");
    await refreshState();
  }

  return (
    <section className="settings-card">
      <h2>Encrypted optional API keys</h2>
      <p>
        TVmaze does not need a key. This encrypted vault remains available for
        other metadata or poster providers that you may choose later.
      </p>

      {!exists && (
        <div className="vault-create">
          <label>
            Create vault password
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </label>
          <button className="primary-button" onClick={create}>
            Create encrypted vault
          </button>
        </div>
      )}

      {exists && !unlocked && (
        <div className="vault-create">
          <label>
            Vault password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primary-button" onClick={unlock}>
            Unlock vault
          </button>
        </div>
      )}

      {exists && unlocked && (
        <>
          <div className="vault-fields">
            {SECRET_FIELDS.map((field) => {
              const saved = storedIds.includes(field.id);

              return (
                <div className="vault-field" key={field.id}>
                  <div>
                    <strong>{field.label}</strong>
                    <p>{field.help}</p>
                  </div>

                  <input
                    type="password"
                    value={values[field.id] ?? ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.id]: event.target.value,
                      }))
                    }
                    placeholder={
                      saved ? "Saved - reveal or replace" : "Enter credential"
                    }
                  />

                  <div className="vault-actions">
                    <button
                      className="primary-button"
                      onClick={() => save(field.id)}
                    >
                      Save encrypted
                    </button>

                    {saved && (
                      <>
                        <button
                          className="secondary-button"
                          onClick={() => reveal(field.id)}
                        >
                          Reveal
                        </button>
                        <button
                          className="danger-button"
                          onClick={() => remove(field.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="vault-footer">
            <button className="secondary-button" onClick={lock}>
              Lock vault
            </button>
            <button className="danger-button" onClick={removeVault}>
              Delete vault
            </button>
          </div>
        </>
      )}

      {message && <div className="scan-summary">{message}</div>}

      <p className="vault-security-note">
        Vault credentials stay encrypted in IndexedDB and are excluded from
        StreamLocal library exports.
      </p>
    </section>
  );
}
