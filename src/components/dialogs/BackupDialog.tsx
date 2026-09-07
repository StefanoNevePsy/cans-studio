import { Copy, Eye, EyeOff, LockKeyhole, ShieldCheck, X } from "lucide-react";
import { useEffect } from "react";
import type { BackupDialogState } from "../../types/cans";

export function BackupDialog({
  state,
  setState,
  generatePassphrase,
  copyPassphrase,
  close,
  confirm,
}: {
  state: BackupDialogState;
  setState: (value: BackupDialogState | null) => void;
  generatePassphrase: () => void;
  copyPassphrase: () => void;
  close: () => void;
  confirm: () => void;
}) {
  const exporting = state.mode === "export";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !state.busy) close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, state.busy]);

  return (
    <div className="modal-backdrop" onMouseDown={state.busy ? undefined : close}>
      <section
        className="modal backup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyeline">
              {exporting ? "Protezione del backup" : "Importazione protetta"}
            </p>
            <h2 id="backup-title">
              {exporting ? "Crea backup completo cifrato" : "Sblocca il backup"}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            disabled={state.busy}
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        <div className="backup-content">
          <div className="backup-security-note">
            <ShieldCheck size={19} />
            <p>
              {exporting
                ? "Il file includerà anagrafica, punteggi e note. Comunica la passphrase al destinatario attraverso un canale separato."
                : `Il file ${state.fileName ?? ""} è cifrato. La passphrase non viene memorizzata dall'app.`}
            </p>
          </div>

          <label>
            Passphrase
            <div className="password-field">
              <input
                type={state.showPassphrase ? "text" : "password"}
                value={state.passphrase}
                autoFocus
                autoComplete="off"
                onChange={(event) =>
                  setState({
                    ...state,
                    passphrase: event.target.value,
                    error: "",
                  })
                }
                placeholder={
                  exporting ? "Almeno 12 caratteri" : "Passphrase del backup"
                }
              />
              <button
                type="button"
                className="icon-button"
                onClick={() =>
                  setState({ ...state, showPassphrase: !state.showPassphrase })
                }
                aria-label={
                  state.showPassphrase ? "Nascondi passphrase" : "Mostra passphrase"
                }
              >
                {state.showPassphrase ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
              {exporting && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={copyPassphrase}
                  disabled={!state.passphrase}
                  aria-label="Copia passphrase"
                  title="Copia passphrase"
                >
                  <Copy size={17} />
                </button>
              )}
            </div>
          </label>

          {exporting && (
            <>
              <label>
                Conferma passphrase
                <input
                  type={state.showPassphrase ? "text" : "password"}
                  value={state.confirmPassphrase}
                  autoComplete="off"
                  onChange={(event) =>
                    setState({
                      ...state,
                      confirmPassphrase: event.target.value,
                      error: "",
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="secondary-button generate-passphrase"
                onClick={generatePassphrase}
              >
                <LockKeyhole size={16} /> Genera passphrase sicura
              </button>
            </>
          )}

          {state.error && (
            <p className="form-error" role="alert">
              {state.error}
            </p>
          )}
        </div>

        <div className="modal-footer">
          <p>
            La passphrase non può essere recuperata. Senza di essa il backup resta
            illeggibile.
          </p>
          <div className="inline-actions">
            <button className="secondary-button" onClick={close} disabled={state.busy}>
              Annulla
            </button>
            <button className="primary-button" onClick={confirm} disabled={state.busy}>
              <LockKeyhole size={16} />
              {state.busy
                ? exporting
                  ? "Cifratura..."
                  : "Sblocco..."
                : exporting
                  ? "Crea backup"
                  : "Importa dati"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
