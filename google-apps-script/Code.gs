// Deploy this bound to the "Catering Bookings Database" Google Sheet:
// Extensions > Apps Script, paste this file's contents, then
// Deploy > New deployment > type "Web app":
//   Execute as: Me
//   Who has access: Anyone
// Copy the resulting URL into catering-booking/config.js as API_URL.

// Columns 1-5 are freely editable. createdBy/createdByName (col 6-ish) are
// set once at creation (from the verified signer, not the client) and
// preserved on edits. timeSlots and createdByName are appended after
// createdBy, in the order they were added, so existing rows in an
// already-live sheet stay correctly aligned — inserting a field earlier
// would shift every existing row's later fields into the wrong column.
const SHEET_HEADERS = ["id", "date", "clientName", "venue", "notes", "createdBy", "timeSlots", "createdByName"];
const EDITABLE_COLUMN_COUNT = 5;
const TIME_SLOTS_COLUMN = 7;

// Must match GOOGLE_CLIENT_ID in catering-booking/config.js — used to check
// that a submitted Google ID token was actually issued for this app.
const GOOGLE_CLIENT_ID = "674405153349-hbk3btuh2bfgq7jj0ov1pt001uunj2gs.apps.googleusercontent.com";

// Permanent admins — always authorized, can manage the staff allowlist
// below, and can never be removed via the admin page since they aren't
// stored in the AllowedUsers sheet at all. Must match ADMIN_EMAILS in
// config.js (that copy only controls whether the Admin UI is shown; this
// one is what's actually enforced).
const ADMIN_EMAILS = ["ibundacatering@gmail.com", "shukorabdullah95.sa@gmail.com"];

const USERS_SHEET_NAME = "AllowedUsers";
// Seeded once, the first time the AllowedUsers sheet is created, so the
// people already actively using the app don't get locked out. Role is
// "staff" (can view + add/edit/delete bookings) or "viewer" (view only).
const SEED_ALLOWED_USERS = [
  { email: "shukorabdullah95.sa@gmail.com", role: "staff" },
  { email: "faiznaqib9@gmail.com", role: "staff" },
];

// Verifies a Google Sign-In ID token via Google's tokeninfo endpoint (checks
// signature, expiry, and audience). Returns the verified {email, name}, or
// null if the token is missing, expired, or was not issued for this app.
function verifiedIdentity_(idToken) {
  if (!idToken) return null;
  const res = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;
  const claims = JSON.parse(res.getContentText());
  if (claims.aud !== GOOGLE_CLIENT_ID || claims.email_verified !== "true") return null;
  return { email: claims.email.toLowerCase(), name: claims.name || claims.email };
}

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function getUsersSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    sheet.appendRow(["email", "role"]);
    SEED_ALLOWED_USERS.forEach(u => sheet.appendRow([u.email, u.role]));
  }
  return sheet;
}

// Rows from before "role" existed have a blank column B, which defaults to
// "staff" here so nobody's access silently changes when this ships.
function getAllowedUsers_() {
  const sheet = getUsersSheet_();
  const data = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      users.push({
        email: String(data[i][0]).toLowerCase().trim(),
        role: String(data[i][1] || "staff").toLowerCase().trim() === "viewer" ? "viewer" : "staff",
      });
    }
  }
  return users;
}

function getAllowedEmails_() {
  return getAllowedUsers_().map(u => u.email);
}

function findAllowedUser_(email) {
  return getAllowedUsers_().find(u => u.email === email) || null;
}

function isAdmin_(email) {
  return !!email && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email);
}

// Can sign in and view bookings — admin, staff, or viewer.
function isAuthorized_(email) {
  if (!email) return false;
  if (isAdmin_(email)) return true;
  return getAllowedEmails_().includes(email);
}

// Can create/edit/delete bookings — admin or staff, but not a viewer.
function canWrite_(email) {
  if (!email) return false;
  if (isAdmin_(email)) return true;
  const user = findAllowedUser_(email);
  return !!user && user.role !== "viewer";
}

// A verified-but-not-allowlisted email gets a clearly different message
// than a missing/expired token, so the person understands they need to be
// added rather than thinking they just need to sign in again.
function authErrorMessage_(email) {
  return email
    ? "This Google account is not authorized to use this app. Ask an admin to add it."
    : "Your session expired. Please sign in again.";
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Normalizes a cell value; Sheets sometimes auto-converts "yyyy-mm-dd"
// strings into real Date objects, which would otherwise serialize as
// full ISO timestamps (and can shift a day depending on timezone).
function normalizeValue_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return value;
}

function readBookings_() {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const bookings = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // skip blank rows
    const booking = {};
    SHEET_HEADERS.forEach((key, idx) => {
      booking[key] = normalizeValue_(row[idx]);
    });
    bookings.push(booking);
  }
  return bookings;
}

function findRowById_(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1; // 1-indexed sheet row
  }
  return -1;
}

function doGet(e) {
  const identity = verifiedIdentity_(e.parameter.token);
  const email = identity && identity.email;
  if (!isAuthorized_(email)) {
    return jsonResponse_({ error: authErrorMessage_(email) });
  }
  const role = isAdmin_(email) ? "admin" : (findAllowedUser_(email) || {}).role || "staff";
  return jsonResponse_({ bookings: readBookings_(), role: role });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const payload = JSON.parse(e.postData.contents);
    const identity = verifiedIdentity_(payload.token);
    const email = identity && identity.email;

    // --- Admin-only: manage the staff allowlist ---------------------
    if (payload.action === "listUsers") {
      if (!isAdmin_(email)) return jsonResponse_({ success: false, error: "Forbidden" });
      return jsonResponse_({ success: true, users: getAllowedUsers_() });
    }

    if (payload.action === "addUser") {
      if (!isAdmin_(email)) return jsonResponse_({ success: false, error: "Forbidden" });
      const newEmail = String(payload.email || "").toLowerCase().trim();
      if (!newEmail) return jsonResponse_({ success: false, error: "Email required" });
      const role = payload.role === "viewer" ? "viewer" : "staff";
      const sheet = getUsersSheet_();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).toLowerCase().trim() === newEmail) {
          sheet.getRange(i + 1, 2).setValue(role); // already listed — just update their role
          return jsonResponse_({ success: true });
        }
      }
      sheet.appendRow([newEmail, role]);
      return jsonResponse_({ success: true });
    }

    if (payload.action === "removeUser") {
      if (!isAdmin_(email)) return jsonResponse_({ success: false, error: "Forbidden" });
      const targetEmail = String(payload.email || "").toLowerCase().trim();
      const sheet = getUsersSheet_();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).toLowerCase().trim() === targetEmail) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return jsonResponse_({ success: true });
    }

    // --- Everything else requires write access (admin or staff, not a
    // view-only viewer) ---
    if (!canWrite_(email)) {
      const message = isAuthorized_(email)
        ? "Your account has view-only access. Ask an admin for edit access."
        : authErrorMessage_(email);
      return jsonResponse_({ success: false, error: message });
    }

    const sheet = getSheet_();

    if (payload.action === "create") {
      const b = payload.booking;
      const id = Utilities.getUuid();
      // createdBy/createdByName come from the verified token, never the
      // client payload.
      sheet.appendRow([id, b.date, b.clientName, b.venue, b.notes || "", email, b.timeSlots || "", identity.name]);
      return jsonResponse_({ success: true, id: id });
    }

    if (payload.action === "update") {
      const b = payload.booking;
      const rowIndex = findRowById_(sheet, b.id);
      if (rowIndex === -1) return jsonResponse_({ success: false, error: "Booking not found" });
      sheet.getRange(rowIndex, 1, 1, EDITABLE_COLUMN_COUNT)
        .setValues([[b.id, b.date, b.clientName, b.venue, b.notes || ""]]);
      sheet.getRange(rowIndex, TIME_SLOTS_COLUMN).setValue(b.timeSlots || "");
      return jsonResponse_({ success: true });
    }

    if (payload.action === "delete") {
      const rowIndex = findRowById_(sheet, payload.id);
      if (rowIndex === -1) return jsonResponse_({ success: false, error: "Booking not found" });
      sheet.deleteRow(rowIndex);
      return jsonResponse_({ success: true });
    }

    return jsonResponse_({ success: false, error: "Unknown action: " + payload.action });
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}
