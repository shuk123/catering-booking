// Deploy this bound to the "Catering Bookings Database" Google Sheet:
// Extensions > Apps Script, paste this file's contents, then
// Deploy > New deployment > type "Web app":
//   Execute as: Me
//   Who has access: Anyone
// Copy the resulting URL into catering-booking/config.js as API_URL.

const SHEET_HEADERS = ["id", "date", "clientName", "venue", "notes", "createdBy"];
// Columns 1-5 are user-editable; createdBy (col 6) is set once at creation
// and preserved on edits so it always reflects who originally booked it.
const EDITABLE_COLUMN_COUNT = 5;

// Must match GOOGLE_CLIENT_ID in catering-booking/config.js — used to check
// that a submitted Google ID token was actually issued for this app.
const GOOGLE_CLIENT_ID = "674405153349-hbk3btuh2bfgq7jj0ov1pt001uunj2gs.apps.googleusercontent.com";

// Verifies a Google Sign-In ID token via Google's tokeninfo endpoint (checks
// signature, expiry, and audience). Returns the verified email, or null if
// the token is missing, expired, or was not issued for this app.
function verifiedEmail_(idToken) {
  if (!idToken) return null;
  const res = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;
  const claims = JSON.parse(res.getContentText());
  if (claims.aud !== GOOGLE_CLIENT_ID || claims.email_verified !== "true") return null;
  return claims.email;
}

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
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
  const email = verifiedEmail_(e.parameter.token);
  if (!email) {
    return jsonResponse_({ error: "unauthorized" });
  }
  return jsonResponse_({ bookings: readBookings_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet = getSheet_();

    if (payload.action === "create") {
      const b = payload.booking;
      const id = Utilities.getUuid();
      sheet.appendRow([id, b.date, b.clientName, b.venue, b.notes || "", b.createdBy || ""]);
      return jsonResponse_({ success: true, id: id });
    }

    if (payload.action === "update") {
      const b = payload.booking;
      const rowIndex = findRowById_(sheet, b.id);
      if (rowIndex === -1) return jsonResponse_({ success: false, error: "Booking not found" });
      sheet.getRange(rowIndex, 1, 1, EDITABLE_COLUMN_COUNT)
        .setValues([[b.id, b.date, b.clientName, b.venue, b.notes || ""]]);
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
