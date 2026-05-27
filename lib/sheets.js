import { google } from "googleapis";

const SHEET_NAME = "Posts";
const CLIENTS_SHEET_NAME = "Clients";
const LOG_SHEET_NAME = "Activity Log";
const SOW_SHEET_NAME = "SOW";

const COL = {
  ID: 1, CLIENT: 2, TYPE: 3, DATE: 4, TIME: 5, TITLE: 6,
  CAPTION: 7, ASSET: 8, REMARKS: 9, CREATED_BY: 10, CREATED_AT: 11,
  FB_POSTED: 12, FB_BY: 13, FB_AT: 14,
  IG_POSTED: 15, IG_BY: 16, IG_AT: 17,
  LI_POSTED: 18, LI_BY: 19, LI_AT: 20,
  YT_POSTED: 21, YT_BY: 22, YT_AT: 23,
  TT_POSTED: 24, TT_BY: 25, TT_AT: 26,
  TW_POSTED: 27, TW_BY: 28, TW_AT: 29,
  PLATFORMS_LIST: 30,
};

const PLAT_COL = {
  Facebook:    { posted: COL.FB_POSTED, by: COL.FB_BY, at: COL.FB_AT },
  Instagram:   { posted: COL.IG_POSTED, by: COL.IG_BY, at: COL.IG_AT },
  LinkedIn:    { posted: COL.LI_POSTED, by: COL.LI_BY, at: COL.LI_AT },
  YouTube:     { posted: COL.YT_POSTED, by: COL.YT_BY, at: COL.YT_AT },
  TikTok:      { posted: COL.TT_POSTED, by: COL.TT_BY, at: COL.TT_AT },
  "X / Twitter": { posted: COL.TW_POSTED, by: COL.TW_BY, at: COL.TW_AT },
};

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

function getSheets() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

function colLetter(n) {
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function formatDateForApp(val) {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d)) return String(val);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch { return String(val); }
}

function formatTimeForApp(val) {
  if (!val) return "";
  try {
    if (typeof val === "string" && val.includes(":")) return val.substring(0, 5);
    const d = new Date(val);
    if (isNaN(d)) return String(val);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  } catch { return String(val); }
}

// ── ENSURE SHEETS EXIST ──────────────────────────────────────
export async function setupSheets() {
  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingNames = meta.data.sheets.map(s => s.properties.title);

  const toCreate = [];
  if (!existingNames.includes(SHEET_NAME)) toCreate.push({ addSheet: { properties: { title: SHEET_NAME } } });
  if (!existingNames.includes(CLIENTS_SHEET_NAME)) toCreate.push({ addSheet: { properties: { title: CLIENTS_SHEET_NAME } } });
  if (!existingNames.includes(LOG_SHEET_NAME)) toCreate.push({ addSheet: { properties: { title: LOG_SHEET_NAME } } });
  if (!existingNames.includes(SOW_SHEET_NAME)) toCreate.push({ addSheet: { properties: { title: SOW_SHEET_NAME } } });

  if (toCreate.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: toCreate } });
  }

  // Set headers for Posts sheet if empty
  const postsCheck = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A1` });
  if (!postsCheck.data.values) {
    const headers = [
      "ID","Client","Type","Date","Time","Title","Caption","Asset Link","Remarks",
      "Created By","Created At",
      "Facebook Posted?","Facebook By","Facebook At",
      "Instagram Posted?","Instagram By","Instagram At",
      "LinkedIn Posted?","LinkedIn By","LinkedIn At",
      "YouTube Posted?","YouTube By","YouTube At",
      "TikTok Posted?","TikTok By","TikTok At",
      "X/Twitter Posted?","X/Twitter By","X/Twitter At",
      "Platforms List"
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }

  const clientsCheck = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${CLIENTS_SHEET_NAME}!A1` });
  if (!clientsCheck.data.values) {
    const defaultClients = [
      ["Client Name","Platforms"],
      ["Softradix","LinkedIn,Facebook,Instagram,YouTube"],
      ["PyaraBaby","Facebook,Instagram"],
      ["LMK Finance","Facebook,Instagram,LinkedIn"],
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CLIENTS_SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: defaultClients },
    });
  }

  // SOW sheet — Client Name, Service Type, Creatives Required, Priority, Status + monthly tracker
  // Columns: A=ID, B=Client Name, C=Service Type, D=Creatives Required, E=Priority, F=Status
  // Monthly tracker cols: G=YYYY-MM, H=Made (repeating pairs per month)
  try {
    const sowCheck = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SOW_SHEET_NAME}!A1` });
    if (!sowCheck.data.values) {
      const sowHeaders = [["ID","Client Name","Service Type","Creatives Required","Priority","Status"]];
      const sowSeed = [
        ["1","SummarizeX","PPC","-","A","Active"],
        ["2","Pyarababy","PPC + Organic","17","B","Active"],
        ["3","Courtesy Honda","Organic + PPC","25","C","Active"],
        ["4","Shecare","Organic + PPC","5","D","Inactive"],
        ["5","SSW","PPC + Organic","25","A","Active"],
        ["6","VOLVO","PPC + Organic","5","A","Active"],
        ["7","VERISEEK","PPC + Organic","20","A","Active"],
        ["8","ASIA","PPC + Organic","15","A","Active"],
        ["9","LMK","Organic","15","B","Active"],
        ["10","HONDA","PPC + Organic","25","C","Active"],
        ["11","FAITH","PPC + Organic","10","D","Active"],
        ["12","PRATHA","PPC + Organic","17","B","Active"],
        ["13","Tress Lounge","Organic","5","B","Inactive"],
        ["14","North International","PPC","4","C","Active"],
        ["15","MANTHAN","PPC + Organic","12","B","Active"],
        ["16","Softradix","PPC + Organic + 4 BLOGS","10","B","Active"],
        ["17","OUTLANDER","PPC","15","B","Active"],
        ["18","KIA","Organic","4","B","Active"],
        ["19","Social Magnet","Organic","5","B","Active"],
        ["20","BODY TEMPLE","PPC + GMB + Organic","15","B","Active"],
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SOW_SHEET_NAME}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [...sowHeaders, ...sowSeed] },
      });
    }
  } catch {}
}

// ── AUTH ─────────────────────────────────────────────────────
export function verifyPin(pin) {
  const PM_PIN = process.env.PM_PIN || "1234";
  const POSTING_PIN = process.env.POSTING_PIN || "5678";
  if (pin === PM_PIN) return { ok: true, role: "pm" };
  if (pin === POSTING_PIN) return { ok: true, role: "posting" };
  return { ok: false, role: null };
}

// ── CLIENTS ──────────────────────────────────────────────────
export async function getClients() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CLIENTS_SHEET_NAME}!A:B`,
  });
  const rows = res.data.values || [];
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const name = rows[i][0];
    const plats = rows[i][1];
    if (name) result[name] = plats ? plats.split(",").map(p => p.trim()) : [];
  }
  return result;
}

export async function saveClients(clientsObj) {
  const sheets = getSheets();
  // Clear existing
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CLIENTS_SHEET_NAME}!A2:B1000`,
  });
  const rows = Object.entries(clientsObj).map(([name, plats]) => [name, plats.join(",")]);
  if (rows.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CLIENTS_SHEET_NAME}!A2`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
  }
  await logActivity("Clients Updated", "", "Client list updated by PM", "PM");
}

// ── POSTS ────────────────────────────────────────────────────
export async function getPosts() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:AD2000`,
  });
  const rows = res.data.values || [];
  const posts = rows
    .filter(r => r[COL.ID - 1])
    .map(r => {
      const platformsList = r[COL.PLATFORMS_LIST - 1]
        ? r[COL.PLATFORMS_LIST - 1].split(",").map(p => p.trim())
        : [];
      const platforms = platformsList.map(pname => {
        const cols = PLAT_COL[pname];
        if (!cols) return { name: pname, posted: false, postedBy: "", postedAt: "" };
        return {
          name: pname,
          posted: r[cols.posted - 1] === "Yes",
          postedBy: r[cols.by - 1] || "",
          postedAt: r[cols.at - 1] || "",
        };
      });
      return {
        id: String(r[COL.ID - 1]),
        client: r[COL.CLIENT - 1] || "",
        type: r[COL.TYPE - 1] || "",
        date: formatDateForApp(r[COL.DATE - 1]),
        time: formatTimeForApp(r[COL.TIME - 1]),
        title: r[COL.TITLE - 1] || "",
        caption: r[COL.CAPTION - 1] || "",
        asset: r[COL.ASSET - 1] || "",
        remarks: r[COL.REMARKS - 1] || "",
        createdBy: r[COL.CREATED_BY - 1] || "",
        createdAt: r[COL.CREATED_AT - 1] || "",
        platforms,
      };
    });
  return posts;
}

export async function createPost(postData) {
  const sheets = getSheets();
  const id = Date.now().toString();
  const now = new Date().toLocaleString("en-IN");
  const row = new Array(30).fill("");
  row[COL.ID - 1] = id;
  row[COL.CLIENT - 1] = postData.client;
  row[COL.TYPE - 1] = postData.type;
  row[COL.DATE - 1] = postData.date;
  row[COL.TIME - 1] = postData.time;
  row[COL.TITLE - 1] = postData.title;
  row[COL.CAPTION - 1] = postData.caption;
  row[COL.ASSET - 1] = postData.asset;
  row[COL.REMARKS - 1] = postData.remarks;
  row[COL.CREATED_BY - 1] = "PM";
  row[COL.CREATED_AT - 1] = now;
  row[COL.PLATFORMS_LIST - 1] = postData.platforms.join(",");
  postData.platforms.forEach(pname => {
    const cols = PLAT_COL[pname];
    if (cols) row[cols.posted - 1] = "No";
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
  await logActivity("Post Created", id, `"${postData.title}" for ${postData.client}`, "PM");
  return id;
}

export async function markPlatformPosted(postId, platformName, postedBy, screenshotLink) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:A2000`,
  });
  const ids = (res.data.values || []).map(r => String(r[0]));
  const rowIndex = ids.findIndex(id => id === String(postId));
  if (rowIndex === -1) throw new Error("Post not found");
  const sheetRow = rowIndex + 2;
  const cols = PLAT_COL[platformName];
  if (!cols) throw new Error("Unknown platform");
  const now = new Date().toLocaleString("en-IN");
  // Store: Yes | postedBy | timestamp | screenshotLink (in "at" col, append link after timestamp)
  const atValue = screenshotLink ? `${now} | ${screenshotLink}` : now;
  const range = `${SHEET_NAME}!${colLetter(cols.posted)}${sheetRow}:${colLetter(cols.at)}${sheetRow}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [["Yes", postedBy, atValue]] },
  });
  await logActivity("Platform Posted", postId, `${platformName} posted by ${postedBy}${screenshotLink ? " (with screenshot)" : ""}`, postedBy);
}

export async function uploadScreenshotToDrive(fileBase64, fileName, mimeType, clientName) {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const PARENT_FOLDER_ID = "1G5gUQoR7YlYpiP6VaQHlcfT44W4tmtId";

  // Find or create client subfolder
  const folderSearch = await drive.files.list({
    q: `name='${clientName}' and mimeType='application/vnd.google-apps.folder' and '${PARENT_FOLDER_ID}' in parents and trashed=false`,
    fields: "files(id,name)",
  });

  let folderId;
  if (folderSearch.data.files.length > 0) {
    folderId = folderSearch.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      requestBody: { name: clientName, mimeType: "application/vnd.google-apps.folder", parents: [PARENT_FOLDER_ID] },
      fields: "id",
    });
    folderId = folder.data.id;
  }

  // Upload file using buffer directly
  const buffer = Buffer.from(fileBase64, "base64");
  const { PassThrough } = require("stream");
  const stream = new PassThrough();
  stream.end(buffer);

  const file = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: "id,webViewLink",
  });

  return file.data.webViewLink;
}

export async function updatePost(postData) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:AD2000`,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex(r => String(r[COL.ID - 1]) === String(postData.id));
  if (rowIndex === -1) throw new Error("Post not found");
  const sheetRow = rowIndex + 2;

  const existingPlatsList = rows[rowIndex][COL.PLATFORMS_LIST - 1] || "";
  const existingPlats = existingPlatsList.split(",").map(p => p.trim()).filter(Boolean);

  // Check if date changed — if so, reset ALL platform statuses
  const existingDate = rows[rowIndex][COL.DATE - 1] || "";
  const dateChanged = postData.resetPlatforms || (existingDate && existingDate !== postData.date);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!B${sheetRow}:I${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[postData.client, postData.type, postData.date, postData.time, postData.title, postData.caption, postData.asset, postData.remarks]] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!${colLetter(COL.PLATFORMS_LIST)}${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[postData.platforms.join(",")]] },
  });

  // If date changed, reset ALL platforms to No
  if (dateChanged) {
    for (const pname of Object.keys(PLAT_COL)) {
      const cols = PLAT_COL[pname];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!${colLetter(cols.posted)}${sheetRow}:${colLetter(cols.at)}${sheetRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [["No", "", ""]] },
      });
    }
    await logActivity("Post Rescheduled", postData.id, `"${postData.title}" rescheduled to ${postData.date} — all platforms reset`, "PM");
  } else {
    // Only init brand new platforms
    for (const pname of postData.platforms) {
      if (!existingPlats.includes(pname)) {
        const cols = PLAT_COL[pname];
        if (cols) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!${colLetter(cols.posted)}${sheetRow}`,
            valueInputOption: "RAW",
            requestBody: { values: [["No"]] },
          });
        }
      }
    }
  }
  await logActivity("Post Updated", postData.id, `"${postData.title}" updated by PM`, "PM");
}

export async function deletePost(postId) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:A2000`,
  });
  const ids = (res.data.values || []).map(r => String(r[0]));
  const rowIndex = ids.findIndex(id => id === String(postId));
  if (rowIndex === -1) throw new Error("Post not found");
  const sheetRow = rowIndex + 2;

  // Get sheet ID for batchUpdate
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetMeta = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);
  const sheetId = sheetMeta.properties.sheetId;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: sheetRow - 1, endIndex: sheetRow },
        },
      }],
    },
  });
  await logActivity("Post Deleted", postId, `Post ${postId} deleted by PM`, "PM");
}

// ── SOW ──────────────────────────────────────────────────────
// Sheet columns: A=ID, B=Client Name, C=Service Type, D=Creatives Required, E=Priority, F=Status
// Monthly tracker stored in a separate sheet "SOW Tracker": A=ID(client), B=Month(YYYY-MM), C=Made

export async function getSOW() {
  const sheets = getSheets();
  const [sowRes, trackerRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SOW_SHEET_NAME}!A2:F1000` }),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `SOW Tracker!A2:C10000` }).catch(()=>({data:{values:[]}})),
  ]);
  const rows = (sowRes.data.values || []).filter(r => r[0]);
  const trackerRows = trackerRes.data.values || [];
  // Build tracker map: { clientId: { "YYYY-MM": made } }
  const tracker = {};
  trackerRows.forEach(r => {
    if(!r[0]) return;
    if(!tracker[r[0]]) tracker[r[0]] = {};
    tracker[r[0]][r[1]] = parseInt(r[2])||0;
  });
  return rows.map(r => ({
    id: String(r[0]),
    clientName: r[1]||"",
    serviceType: r[2]||"",
    creativesRequired: r[3]||"-",
    priority: r[4]||"B",
    status: r[5]||"Active",
    tracker: tracker[String(r[0])] || {},
  }));
}

export async function saveSOWRow(row) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SOW_SHEET_NAME}!A2:A1000` });
  const ids = (res.data.values || []).map(r => String(r[0]));
  const rowValues = [row.id, row.clientName, row.serviceType, row.creativesRequired, row.priority, row.status];
  const idx = ids.findIndex(id => id === String(row.id));
  if (idx === -1) {
    await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: `${SOW_SHEET_NAME}!A2`, valueInputOption: "RAW", requestBody: { values: [rowValues] } });
  } else {
    const sheetRow = idx + 2;
    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${SOW_SHEET_NAME}!A${sheetRow}:F${sheetRow}`, valueInputOption: "RAW", requestBody: { values: [rowValues] } });
  }
  await logActivity("SOW Updated", row.id, `SOW row for "${row.clientName}" updated`, "Admin");
}

export async function saveSOWTracker(clientId, month, made) {
  // Ensure SOW Tracker sheet exists
  const sheets = getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  if (!meta.data.sheets.find(s => s.properties.title === "SOW Tracker")) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: "SOW Tracker" } } }] } });
    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `SOW Tracker!A1`, valueInputOption: "RAW", requestBody: { values: [["Client ID","Month","Made"]] } });
  }
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `SOW Tracker!A2:B10000` });
  const rows = res.data.values || [];
  const idx = rows.findIndex(r => String(r[0]) === String(clientId) && r[1] === month);
  if (idx === -1) {
    await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: `SOW Tracker!A2`, valueInputOption: "RAW", requestBody: { values: [[clientId, month, made]] } });
  } else {
    const sheetRow = idx + 2;
    await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `SOW Tracker!A${sheetRow}:C${sheetRow}`, valueInputOption: "RAW", requestBody: { values: [[clientId, month, made]] } });
  }
}

export async function deleteSOWRow(id) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SOW_SHEET_NAME}!A2:A1000` });
  const ids = (res.data.values || []).map(r => String(r[0]));
  const idx = ids.findIndex(x => x === String(id));
  if (idx === -1) throw new Error("Row not found");
  const sheetRow = idx + 2;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetMeta = meta.data.sheets.find(s => s.properties.title === SOW_SHEET_NAME);
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: [{ deleteDimension: { range: { sheetId: sheetMeta.properties.sheetId, dimension: "ROWS", startIndex: sheetRow - 1, endIndex: sheetRow } } }] } });
}

async function logActivity(action, postId, details, user) {
  try {
    const sheets = getSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${LOG_SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [[new Date().toLocaleString("en-IN"), action, postId, details, user]] },
    });
  } catch {}
}
