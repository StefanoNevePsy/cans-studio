import { UsersRound } from "lucide-react";

export function EmptyPatient() {
  return (
    <section className="empty-panel">
      <UsersRound size={36} />
      <h2>Aggiungi la prima persona</h2>
      <p>
        Inserisci nome, cognome e data di nascita nella barra laterale. Il sistema
        assegnerà anche un codice stabile per unire correttamente i backup.
      </p>
    </section>
  );
}
