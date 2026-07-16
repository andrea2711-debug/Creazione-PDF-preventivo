const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

// --- Font di default pdfmake (Helvetica, non serve caricare file esterni) ---
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

// --- Header caricato una sola volta (riusato tra invocazioni "warm") ---
let headerBase64 = null;
function getHeaderImage() {
  if (!headerBase64) {
    const imgPath = path.join(__dirname, '..', 'assets', 'header.png');
    const buf = fs.readFileSync(imgPath);
    headerBase64 = 'data:image/png;base64,' + buf.toString('base64');
  }
  return headerBase64;
}

function formatEuro(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function buildDocDefinition(payload) {
  const numeroPreventivo = payload.numeroPreventivo || '';
  const cliente = payload.cliente || '';
  const indirizzoCliente = payload.indirizzoCliente || '';
  const righe = Array.isArray(payload.righe) ? payload.righe : [];
  const ivaPercentuale = payload.ivaPercentuale != null ? Number(payload.ivaPercentuale) : 10;

  const imponibile = righe.reduce(function (acc, r) {
    const totale = r.totaleLavorazione != null
      ? Number(r.totaleLavorazione)
      : Number(r.quantita || 0) * Number(r.prezzoUnitario || 0);
    return acc + totale;
  }, 0);

  const iva = imponibile * (ivaPercentuale / 100);
  const totaleComplessivo = imponibile + iva;

  const righeContent = righe.map(function (r) {
    const quantita = r.quantita != null ? r.quantita : '';
    const unitaMisura = r.unitaMisura || '';
    const prezzoUnitario = r.prezzoUnitario != null ? formatEuro(r.prezzoUnitario) : '';
    const totaleLavorazione = r.totaleLavorazione != null
      ? Number(r.totaleLavorazione)
      : Number(r.quantita || 0) * Number(r.prezzoUnitario || 0);

    return {
      margin: [0, 0, 0, 12],
      stack: [
        { text: r.lavorazione || '', bold: true, fontSize: 11 },
        { text: r.descrizione || '', fontSize: 10, margin: [0, 2, 0, 4] },
        {
          text: 'Quantità: ' + quantita + ' ' + unitaMisura +
            '   x   Prezzo unitario: ' + prezzoUnitario +
            '   =   ' + formatEuro(totaleLavorazione),
          fontSize: 10,
          italics: true
        }
      ]
    };
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 140, 40, 60],

    header: function () {
      return {
        image: getHeaderImage(),
        width: 515,
        margin: [40, 20, 40, 0]
      };
    },

    footer: function () {
      return {
        margin: [40, 10, 40, 0],
        fontSize: 8,
        color: '#555555',
        text: [
          'All. 08.02.03\n',
          'Rev. 0 del 30/07/25'
        ]
      };
    },

    content: [
      {
        columns: [
          {
            width: '*',
            text: 'Preventivo n. ' + numeroPreventivo,
            bold: true,
            fontSize: 12
          },
          {
            width: '*',
            alignment: 'right',
            stack: [
              { text: cliente, bold: true },
              { text: indirizzoCliente }
            ]
          }
        ],
        margin: [0, 0, 0, 25]
      },

      { text: 'PREVENTIVO LAVORI', bold: true, fontSize: 13, margin: [0, 0, 0, 15] },

      righeContent,

      {
        margin: [0, 15, 0, 0],
        alignment: 'right',
        stack: [
          { text: 'Imponibile: ' + formatEuro(imponibile) },
          { text: 'IVA ' + ivaPercentuale + '%: ' + formatEuro(iva) },
          { text: 'Totale complessivo: ' + formatEuro(totaleComplessivo), bold: true, fontSize: 12, margin: [0, 4, 0, 0] }
        ]
      }
    ],

    defaultStyle: {
      font: 'Helvetica',
      fontSize: 10
    }
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo non consentito, usare POST' });
    return;
  }

  try {
    const payload = req.body;

    if (!payload || !payload.numeroPreventivo || !Array.isArray(payload.righe)) {
      res.status(400).json({ error: 'Payload non valido: servono numeroPreventivo e righe[]' });
      return;
    }

    const printer = new PdfPrinter(fonts);
    const docDefinition = buildDocDefinition(payload);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    const chunks = [];
    pdfDoc.on('data', function (chunk) { chunks.push(chunk); });
    pdfDoc.on('end', function () {
      const pdfBuffer = Buffer.concat(chunks);
      res.status(200).json({ base64: pdfBuffer.toString('base64') });
    });
    pdfDoc.end();
  } catch (err) {
    res.status(500).json({ error: 'Errore generazione PDF: ' + err.message });
  }
};
