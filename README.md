# CANS Studio

Applicazione React per la compilazione collaborativa, lo scoring e il confronto
nel tempo degli strumenti CANS 0-5 e CANS 5-17+.

## Funzioni principali

- gestione di più pazienti e intervalli temporali;
- sottosomministrazioni separate per genitori, clinici e altre fonti;
- sospensione e ripresa delle compilazioni;
- moduli di approfondimento aperti sotto il relativo item di screening;
- descrizioni e criteri di scoring consultabili e modificabili;
- fusione guidata delle fonti con evidenza delle discordanze e delle note;
- stella CANS, sintesi operative e confronto longitudinale;
- modalità chiara e scura;
- esportazione Excel e grafici PNG;
- backup completo cifrato con passphrase;
- progetto Android Capacitor con icona per Material You.

## Privacy

CANS Studio non utilizza un server applicativo. I dati inseriti restano nel
browser o nel dispositivo e vengono trasferiti solo attraverso le funzioni di
esportazione scelte dall'utente.

Il backup `.cansbackup` è cifrato. L'esportazione Excel e i file PNG non sono
cifrati e devono essere gestiti secondo le procedure dell'organizzazione.

La versione pubblicata su GitHub Pages contiene esclusivamente il codice
dell'applicazione: i dati presenti nel browser di uno specifico professionista
non vengono caricati nel repository.

## Avvio locale

Richiede Node.js 22 o successivo.

```bash
npm ci
npm run dev
```

Build di produzione:

```bash
npm run build
```

## Android

Per aggiornare build web, icone e asset Capacitor è disponibile:

```text
build-android-capacitor-assets.bat
```

In alternativa:

```bash
npm run android:build
npm run android:open
```

## GitHub Pages

Il workflow in `.github/workflows/pages.yml` crea e pubblica automaticamente
la build a ogni push sul branch `main`.

Nelle impostazioni della repository, la sorgente di Pages deve essere
`GitHub Actions`.

Su Windows è disponibile anche `publish-github-pages.bat`, che prepara il
repository, esegue l'accesso tramite GitHub CLI, pubblica il branch `main` e
abilita Pages.

## Avvertenza

L'app supporta il lavoro del professionista formato CANS e non sostituisce i
manuali, la formazione, il giudizio clinico o le procedure dell'organizzazione.
I contenuti CANS e i relativi manuali restano soggetti ai diritti dei rispettivi
autori ed enti.
