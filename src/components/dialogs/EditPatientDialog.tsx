import { AlertTriangle, Check, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Patient } from "../../types/cans";
import { composeBirthDate, patientName } from "../../utils/cansMath";

export function EditPatientDialog({
  patient,
  close,
  onSave,
  onDelete,
}: {
  patient: Patient;
  close: () => void;
  onSave: (updated: {
    firstName: string;
    lastName: string;
    birthDate: string;
    code: string;
  }) => void;
  onDelete?: (patientId: string) => void;
}) {
  const initialYear = patient.birthDate ? patient.birthDate.slice(0, 4) : "";
  const initialMonth = patient.birthDate ? patient.birthDate.slice(5, 7) : "";
  const initialDay = patient.birthDate ? patient.birthDate.slice(8, 10) : "";

  const [firstName, setFirstName] = useState(patient.firstName);
  const [lastName, setLastName] = useState(patient.lastName);
  const [code, setCode] = useState(patient.code);
  const [day, setDay] = useState(initialDay);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  const validatedBirthDate = composeBirthDate(day, month, year);
  const isValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    code.trim().length > 0 &&
    Boolean(validatedBirthDate);

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: validatedBirthDate,
      code: code.trim(),
    });
    close();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(patient.id);
      close();
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <section
        className="modal edit-patient-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-patient-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyeline">Anagrafica</p>
            <h2 id="edit-patient-title">Modifica dati persona</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body edit-patient-body">
          <div className="patient-form-grid">
            <label>
              Nome
              <input
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Nome"
              />
            </label>

            <label>
              Cognome
              <input
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Cognome"
              />
            </label>

            <label>
              Data di nascita
              <span className="birth-date-fields">
                <input
                  inputMode="numeric"
                  value={day}
                  maxLength={2}
                  aria-label="Giorno di nascita"
                  onChange={(event) =>
                    setDay(event.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  placeholder="GG"
                />
                <span aria-hidden="true">/</span>
                <input
                  inputMode="numeric"
                  value={month}
                  maxLength={2}
                  aria-label="Mese di nascita"
                  onChange={(event) =>
                    setMonth(event.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  placeholder="MM"
                />
                <span aria-hidden="true">/</span>
                <input
                  inputMode="numeric"
                  value={year}
                  maxLength={4}
                  aria-label="Anno di nascita"
                  onChange={(event) =>
                    setYear(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="AAAA"
                />
              </span>
            </label>

            <label>
              Codice identificativo
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Codice persona (es. P-001)"
              />
            </label>
          </div>

          {!validatedBirthDate && (day || month || year) && (
            <p className="validation-warning">
              Data di nascita non valida o futura. Formato richiesto: GG/MM/AAAA.
            </p>
          )}

          {onDelete && (
            <div className="danger-zone">
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  className="ghost-button danger"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={15} /> Elimina questa persona
                </button>
              ) : (
                <div className="delete-confirm-box">
                  <div className="delete-confirm-text">
                    <AlertTriangle size={18} className="danger-icon" />
                    <span>
                      Sei sicuro di voler eliminare definitivamente{" "}
                      <strong>{patientName(patient)}</strong> e tutti i suoi
                      intervalli T? Questa operazione non può essere annullata.
                    </span>
                  </div>
                  <div className="delete-confirm-actions">
                    <button
                      type="button"
                      className="danger-button"
                      onClick={handleDelete}
                    >
                      <Trash2 size={15} /> Sì, elimina definitivamente
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={close}>
            Annulla
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={!isValid}
          >
            <Check size={16} /> Salva modifiche
          </button>
        </div>
      </section>
    </div>
  );
}
