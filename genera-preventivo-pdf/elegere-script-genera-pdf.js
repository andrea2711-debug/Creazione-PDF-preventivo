// Script eLegere Script (JavaScript) da collegare al bottone/azione sulla riga
// della tabella "Preventivi".
//
// IMPORTANTE - differenza chiave rispetto alla versione precedente:
// $CURRENTSTORAGE.campo e' sintassi delle FORMULE eLegere, non e' valido dentro
// eLegere Script. eLegere Script e' vero JavaScript async/await e usa l'oggetto
// "context" fornito automaticamente da eLegere, piu' la classe Application con
// metodi saveOne()/getDetails()/getItems() ecc.
//
// PUNTI DA VERIFICARE AL PRIMO TEST (non posso confermarli io):
// 1) Se questa Custom Action e' "Manual" (lanciata dal bottone sulla riga),
//    verifica come si chiama il campo che contiene la riga corrente nel
//    context: potrebbe essere context.NewItem (come negli esempi con eventi
//    PRE/POST UPDATE) oppure un altro campo tipo context.Item / context.Row.
//    Se "context.NewItem" risulta undefined, prova context.Item.
// 2) "detailName" deve essere il NOME del Detail Tab cosi' come configurato in
//    Design Mode (es. "Dettaglio Voci Preventivo"), non il nome fisico dello
//    storage e non la Relation Key.
// 3) "fetch()" presuppone che l'ambiente di scripting di eLegere supporti le
//    chiamate HTTP verso URL esterni in questo modo. Se da errore, potrebbe
//    servire una sintassi diversa per le chiamate esterne (dimmi l'errore).

const app = await elegere.getApplicationFromToken(
  context.ApplicationId,
  context.DomainId,
  context.Url,
  context.SessionToken
);

const currentRow = context.NewItem; // riga Preventivi corrente (da verificare, vedi punto 1)

// --- 1. Recupero righe di dettaglio collegate a questa riga master ---
const detailName = "Dettaglio Voci Preventivo"; // nome del Detail Tab, da verificare (punto 2)
const filter = "numericIdDettaglioPreventivo eq " + currentRow.Id;
const detailResult = await app.getDetails(detailName, filter, 1000);
const righeDettaglio = detailResult.Items;

// --- 2. Costruzione payload per l'endpoint Vercel ---
const righePayload = righeDettaglio.map(function (r) {
  return {
    lavorazione: r.stringLavorazione,
    descrizione: r.stringDescrizione,
    quantita: r.numericQuantita,
    unitaMisura: r.numericUnitadiMisura,
    prezzoUnitario: r.numericPrezzoUnitario,
    totaleLavorazione: r.numericTotaleLavorazione
  };
});

const payload = {
  numeroPreventivo: currentRow.stringNumeroPreventivo,
  cliente: currentRow.stringCliente,
  indirizzoCliente: currentRow.stringIndirizzoCliente,
  ivaPercentuale: 10,
  righe: righePayload
};

// --- 3. Chiamata all'endpoint Vercel che genera il PDF ---
const response = await fetch("https://genera-preventivo-pdf.vercel.app/api/genera-preventivo-pdf", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});
const risposta = await response.json();

if (risposta.error) {
  throw new Error("Errore endpoint PDF: " + risposta.error);
}

// --- 4. Salvataggio del PDF (base64) nel campo File della riga master ---
// Il tipo File di eLegere accetta direttamente una stringa Base64.
const saveResult = await app.saveOne({
  Id: currentRow.Id,
  TIMESTAMP: currentRow.TIMESTAMP,
  filePdfPreventivo: risposta.base64
});
