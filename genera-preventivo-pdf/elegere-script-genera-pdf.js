// Script da collegare al bottone/azione sulla riga della tabella "Preventivi"
// Convenzioni seguite: concatenazione di stringhe (niente template literal, causano
// fallimenti silenziosi in eLegere), timeout alzato a 60s nello slider dell'azione.

var currentRow = $CURRENTSTORAGE;

// --- 1. Recupero righe di dettaglio collegate a questa riga master ---
// Sostituire RELATION_KEY con la Relation Key del dettaglio "Dettaglio Voci Preventivo"
// (vedi tutorial "Recuperare la Relation Key di un Dettaglio" nella doc eLegere).
var relationKey = "f16e802a-0334-4dfe-a799-f5c13b7da00a";

var queryDettaglio = "$top=1000&$filter=numericIdDettaglioPreventivo eq " +
  currentRow.idPreventivi + "&relationKey=" + relationKey;

var righeDettaglio = elegere.get("/SmartExplorerApi/api/items", queryDettaglio);

// --- 2. Costruzione payload per l'endpoint Vercel ---
var righePayload = [];
for (var i = 0; i < righeDettaglio.length; i++) {
  var r = righeDettaglio[i];
  righePayload.push({
    lavorazione: r.stringLavorazione,
    descrizione: r.stringDescrizione,
    quantita: r.numericQuantita,
    unitaMisura: r.numericUnitadiMisura,
    prezzoUnitario: r.numericPrezzoUnitario,
    totaleLavorazione: r.numericTotaleLavorazione
  });
}

var payload = {
  numeroPreventivo: currentRow.stringNumeroPreventivo,
  cliente: currentRow.stringCliente,
  indirizzoCliente: currentRow.stringIndirizzoCliente,
  ivaPercentuale: 10,
  righe: righePayload
};

// --- 3. Chiamata all'endpoint Vercel che genera il PDF ---
var risposta = elegere.post(
  "https://TUO-PROGETTO.vercel.app/api/genera-preventivo-pdf",
  payload
);

// --- 4. Salvataggio del PDF (base64) nel campo File della riga master ---
// Il tipo File di eLegere accetta direttamente una stringa Base64.
elegere.post("/SmartExplorerApi/api/items/save", {
  Rows: [
    {
      Row: {
        Id: currentRow.Id,
        TIMESTAMP: currentRow.TIMESTAMP,
        filePdfPreventivo: risposta.base64
      },
      Details: []
    }
  ]
});
