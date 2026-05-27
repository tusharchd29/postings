import { setupSheets, getSheets } from "../../lib/sheets";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// SOW id -> correct client name from Clients sheet
const RENAMES = {
  "1": "SummarizeX",           // same
  "2": "PyaraBaby",            // Pyarababy -> PyaraBaby
  "3": "Courtesy Honda",       // same
  "4": "SheCare",              // Shecare -> SheCare
  "5": "SSW",                  // same
  "6": "Volvo",                // VOLVO -> Volvo
  "7": "VeriSeek",             // VERISEEK -> VeriSeek
  "8": "Asia Cosmetic",        // ASIA -> Asia Cosmetic
  "9": "LMK Finance",          // LMK -> LMK Finance
  "10": "Honda",               // HONDA -> Honda
  "11": "Faith Diagnostic",    // FAITH -> Faith Diagnostic
  "12": "Pratha Pre School",   // PRATHA -> Pratha Pre School
  "13": "Tress Lounge",        // same
  "14": "North International", // same
  "15": "Manthan Work Spaces", // MANTHAN -> Manthan Work Spaces
  "16": "Softradix",           // same
  "17": "OUTLANDER",           // same
  "18": "Kia",                 // KIA -> Kia
  "19": "Social Magnet",       // same
  "20": "Body Temple",         // BODY TEMPLE -> Body Temple
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    await setupSheets();
    const sheets = getSheets();
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "SOW!A2:F1000",
    });
    const rows = existing.data.values || [];
    const updates = [];
    rows.forEach((row, i) => {
      const id = String(row[0]);
      if (RENAMES[id] && row[1] !== RENAMES[id]) {
        updates.push({
          range: `SOW!B${i + 2}`,
          values: [[RENAMES[id]]],
        });
      }
    });
    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: "RAW", data: updates },
      });
    }
    res.json({ ok: true, updated: updates.length, changes: updates.map(u => ({ range: u.range, name: u.values[0][0] })) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
