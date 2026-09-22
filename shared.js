// Shared across index.html (calendar) and bookings.html (table): API access,
// Google Sign-In, and small utilities. Expects config.js to be loaded first
// and a #syncStatus element to exist on the page.

const PRESET_VENUES = ["Ibunda Garden Hall", "Ibunda Mini Hall", "CSH A"];

// Small inline icons (not a reproduction of any brand's logo — a generic
// chat-bubble shape tinted WhatsApp-green, and a plain pencil) reused by the
// day panel's icon buttons and the bookings table's action dropdown.
const ICON_SHARE = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 1a7 7 0 0 0-6.1 10.4L1 15l3.7-.9A7 7 0 1 0 8 1zm0 12.6c-1 0-2-.3-2.8-.8l-.2-.1-2.1.5.5-2-.1-.2A5.6 5.6 0 1 1 8 13.6z"/></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>`;

// These venues book in fixed slots rather than free-form times. Each venue
// has its own slot set and its own times for the same-sounding slot (Mini
// Hall's "Malam" runs 8.30pm–11.30pm, the other two run 7pm–11pm) — ids are
// only unique per-venue, not globally, so formatTimeSlots always needs the
// venue to resolve the right label. IDs are kept in English even though the
// labels are Malay so existing stored bookings ("morning", "day", etc.)
// keep matching correctly — only change label text here, never the ids.
const VENUE_TIME_SLOTS = {
  "Ibunda Mini Hall": [
    { id: "morning", label: "Pagi (10.30am – 1.30pm)" },
    { id: "evening", label: "Petang (3.30pm – 6.30pm)" },
    { id: "night", label: "Malam (8.30pm – 11.30pm)" },
  ],
  "Ibunda Garden Hall": [
    { id: "day", label: "Siang (10am – 4pm)" },
    { id: "night", label: "Malam (7pm – 11pm)" },
  ],
  "CSH A": [
    { id: "day", label: "Siang (10am – 4pm)" },
    { id: "night", label: "Malam (7pm – 11pm)" },
  ],
};

function slotsForVenue(venue) {
  return VENUE_TIME_SLOTS[venue] || [];
}

// "morning,night" -> "Morning, Night" for compact display in previews/tables.
function formatTimeSlots(csv, venue) {
  if (!csv) return "";
  const slots = slotsForVenue(venue);
  return csv.split(",").map(s => s.trim()).filter(Boolean)
    .map(id => (slots.find(s => s.id === id)?.label || id).split(" (")[0])
    .join(", ");
}

// The slots a venue offers that are NOT yet covered by any booking on the
// same date, or null if the venue has no slot concept at all (distinct
// from an empty array, which means "has slots, but none are free").
function availableSlotsForVenue(venue, venueBookingsForDate) {
  const slots = slotsForVenue(venue);
  if (slots.length === 0) return null;
  const bookedIds = new Set();
  venueBookingsForDate.forEach(b => {
    (b.timeSlots || "").split(",").map(s => s.trim()).filter(Boolean).forEach(id => bookedIds.add(id));
  });
  return slots.filter(slot => !bookedIds.has(slot.id));
}

// True once every slot a venue offers is covered by at least one booking
// on the same date. Venues with no slot concept (e.g. a custom "Others"
// venue) are never considered fully booked.
function isVenueFullyBooked(venue, venueBookingsForDate) {
  const available = availableSlotsForVenue(venue, venueBookingsForDate);
  return available !== null && available.length === 0;
}

// "Shukor Abdullah" -> "Shukor". Bookings created before createdByName
// existed only have an email, so those fall back to showing the email as-is
// rather than guessing a name out of the address.
function firstName(booking) {
  if (booking.createdByName) return booking.createdByName.split(" ")[0];
  return booking.createdBy || "";
}

const MALAY_DAYS = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"]; // index 0 = Sunday

// "2026-09-22" -> "Selasa, 22 September 2026"
function formatMalayDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = MALAY_DAYS[date.getDay()];
  const rest = date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return `${dayName}, ${rest}`;
}

// Builds the pre-filled WhatsApp share text for a booking. wa.me with no
// phone number opens WhatsApp's own chat picker, so the person shares it to
// whichever chat/group they choose — there's no official way for a script
// to post directly into an existing WhatsApp group.
function buildWhatsAppMessage(booking) {
  const lines = [
    "*New Booking*",
    "",
    `*Client:* ${booking.clientName}`,
    `*Date:* ${formatMalayDate(booking.date)}`,
    `*Venue:* ${booking.venue}`,
  ];
  if (booking.timeSlots) {
    lines.push(`*Slot:* ${formatTimeSlots(booking.timeSlots, booking.venue)}`);
  }
  if (booking.notes) {
    lines.push(`*Notes:* ${booking.notes}`);
  }
  lines.push(`*Booked by:* ${firstName(booking) || "-"}`);
  return lines.join("\n");
}

function whatsAppShareUrl(booking) {
  return `https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(booking))}`;
}

// Assigns each venue a distinct color (via a CSS class) for grouping in the
// day panel — presets get fixed colors, any other venue name gets a
// deterministic pick from a small fallback pool so it's stable across
// re-renders without needing to track assignments anywhere.
const VENUE_COLOR_MAP = {
  "Ibunda Garden Hall": "venue-color-1",
  "Ibunda Mini Hall": "venue-color-2",
  "CSH A": "venue-color-3",
};
const VENUE_COLOR_FALLBACKS = ["venue-color-4", "venue-color-5", "venue-color-6", "venue-color-7"];

function colorClassForVenue(venue) {
  if (VENUE_COLOR_MAP[venue]) return VENUE_COLOR_MAP[venue];
  let hash = 0;
  for (let i = 0; i < venue.length; i++) hash = (hash * 31 + venue.charCodeAt(i)) >>> 0;
  return VENUE_COLOR_FALLBACKS[hash % VENUE_COLOR_FALLBACKS.length];
}

const syncStatus = document.getElementById("syncStatus");
const googleSignInBtnContainer = document.getElementById("googleSignInBtn");
const signedInAsEl = document.getElementById("signedInAs");
const userEmailLabel = document.getElementById("userEmailLabel");
const signOutBtn = document.getElementById("signOutBtn");
const adminNavLink = document.getElementById("adminNavLink");
const bookingsNavLink = document.getElementById("bookingsNavLink");

let bookings = [];
// True only once the backend has actually confirmed this signed-in user is
// authorized (not just that they're signed in to some Google account) —
// used to keep the "Bookings List" nav link hidden from everyone else.
let hasAccess = false;

function updateBookingsNavVisibility() {
  bookingsNavLink?.classList.toggle("hidden", !hasAccess);
}

function setStatus(message, isError) {
  syncStatus.textContent = message;
  syncStatus.classList.toggle("error", !!isError);
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatLongDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Data access ------------------------------------------------------

async function refreshBookings() {
  if (!API_URL || API_URL.includes("PASTE_YOUR_DEPLOYED_WEB_APP_URL_HERE")) {
    setStatus("Not connected: set API_URL in config.js to your deployed Apps Script URL.", true);
    return;
  }
  // Bookings are only visible to signed-in users — the Apps Script backend
  // verifies the ID token itself, so this isn't just a UI-level gate.
  if (!currentUser) {
    bookings = [];
    hasAccess = false;
    updateBookingsNavVisibility();
    setStatus("Sign in with Google to view bookings.", true);
    if (typeof onBookingsUpdated === "function") onBookingsUpdated();
    return;
  }
  setStatus("Loading bookings…");
  try {
    const url = `${API_URL}?token=${encodeURIComponent(currentUser.idToken)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    if (data.error) {
      // Either the token is stale, or the account isn't on the allowlist —
      // either way, drop the session so they can't see stale data and the
      // backend's specific message (which distinguishes the two) is shown.
      setCurrentUser(null);
      bookings = [];
      hasAccess = false;
      setStatus(data.error, true);
    } else {
      bookings = data.bookings || [];
      hasAccess = true;
      // Cached alongside the profile so canEdit()/requireEditAccess() work
      // immediately on the next page load without waiting on this fetch.
      currentUser.role = data.role || "staff";
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      setStatus("");
    }
  } catch (err) {
    hasAccess = false;
    setStatus(`Could not load bookings: ${err.message}`, true);
  }
  updateBookingsNavVisibility();
  if (typeof onBookingsUpdated === "function") onBookingsUpdated();
}

async function postToApi(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    // text/plain avoids a CORS preflight against Apps Script; the body is
    // still JSON and is parsed as such server-side.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, token: currentUser?.idToken }),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const result = await res.json();
  if (!result.success) throw new Error(result.error || "Unknown error");
  return result;
}

// --- Google Sign-In -----------------------------------------------------
// The decoded profile (plus the raw ID token, needed to authenticate reads
// against the backend) is cached in localStorage so the person doesn't have
// to re-click "Sign in" every page load. Tokens expire after about an hour;
// once that happens the backend rejects it and refreshBookings() clears the
// stale session, prompting a fresh sign-in.
const AUTH_STORAGE_KEY = "catering-current-user";
let currentUser = loadCurrentUser();

function loadCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
  renderAuthUI();
}

function parseJwt(token) {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
  );
  return JSON.parse(jsonPayload);
}

function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  setCurrentUser({ email: payload.email, name: payload.name || payload.email, idToken: response.credential });
  setStatus("");
  refreshBookings();
}

function renderAuthUI() {
  if (currentUser) {
    googleSignInBtnContainer.classList.add("hidden");
    signedInAsEl.classList.remove("hidden");
    userEmailLabel.textContent = currentUser.email;
  } else {
    googleSignInBtnContainer.classList.remove("hidden");
    signedInAsEl.classList.add("hidden");
  }
  // Cosmetic only — the Apps Script backend enforces the real admin check,
  // so hiding/showing this link is just about not confusing non-admins.
  adminNavLink?.classList.toggle("hidden", !(currentUser && ADMIN_EMAILS.includes(currentUser.email)));
  if (typeof onAuthChanged === "function") onAuthChanged();
}

signOutBtn.addEventListener("click", () => {
  setCurrentUser(null);
  if (window.google?.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }
  refreshBookings();
});

function initGoogleSignIn() {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes("PASTE_YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE")) {
    setStatus("Google Sign-In not configured: set GOOGLE_CLIENT_ID in config.js.", true);
    return;
  }
  if (!window.google?.accounts?.id) {
    setTimeout(initGoogleSignIn, 300); // GIS script loads async; retry until ready
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
  });
  google.accounts.id.renderButton(googleSignInBtnContainer, { theme: "outline", size: "medium" });
}

function requireSignIn() {
  if (currentUser) return true;
  setStatus("Please sign in with Google before adding or editing bookings.", true);
  if (window.google?.accounts?.id) google.accounts.id.prompt();
  return false;
}

// Viewers can sign in and browse normally, but can't add/edit/delete —
// enforced for real by the backend (see canWrite_ in Code.gs); this just
// gives a clear message immediately instead of a round-trip to find out.
// The popup is optional per-page (only index.html has write actions); pages
// without it fall back to the status line.
const viewOnlyOverlay = document.getElementById("viewOnlyOverlay");
const closeViewOnlyModal = document.getElementById("closeViewOnlyModal");

closeViewOnlyModal?.addEventListener("click", () => viewOnlyOverlay.classList.add("hidden"));
viewOnlyOverlay?.addEventListener("click", (e) => {
  if (e.target === viewOnlyOverlay) viewOnlyOverlay.classList.add("hidden");
});

function requireEditAccess() {
  if (!requireSignIn()) return false;
  if (currentUser.role === "viewer") {
    if (viewOnlyOverlay) {
      viewOnlyOverlay.classList.remove("hidden");
    } else {
      setStatus("Your account has view-only access. Ask an admin for edit access.", true);
    }
    return false;
  }
  return true;
}

renderAuthUI();
initGoogleSignIn();

// Lets the app be "installed" (Add to Home Screen / Chrome's install
// prompt) with an offline fallback for the static shell. Silently no-ops
// on browsers/contexts that don't support it (e.g. plain HTTP in some
// browsers — service workers require HTTPS or localhost).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
