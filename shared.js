// Shared across index.html (calendar) and bookings.html (table): API access,
// Google Sign-In, and small utilities. Expects config.js to be loaded first
// and a #syncStatus element to exist on the page.

const PRESET_VENUES = ["Ibunda Garden Hall", "Ibunda Mini Hall", "CSH A"];

const syncStatus = document.getElementById("syncStatus");
const googleSignInBtnContainer = document.getElementById("googleSignInBtn");
const signedInAsEl = document.getElementById("signedInAs");
const userEmailLabel = document.getElementById("userEmailLabel");
const signOutBtn = document.getElementById("signOutBtn");

let bookings = [];

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
  setStatus("Loading bookings…");
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    bookings = data.bookings || [];
    setStatus("");
  } catch (err) {
    setStatus(`Could not load bookings: ${err.message}`, true);
  }
  if (typeof onBookingsUpdated === "function") onBookingsUpdated();
}

async function postToApi(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    // text/plain avoids a CORS preflight against Apps Script; the body is
    // still JSON and is parsed as such server-side.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const result = await res.json();
  if (!result.success) throw new Error(result.error || "Unknown error");
  return result;
}

// --- Google Sign-In -----------------------------------------------------
// The decoded profile is cached in localStorage purely so the person
// doesn't have to re-click "Sign in" every page load; the ID token itself
// is not stored or re-verified, which is an acceptable trade-off for an
// internal booking tool but not a security boundary.
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
  setCurrentUser({ email: payload.email, name: payload.name || payload.email });
  setStatus("");
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
}

signOutBtn.addEventListener("click", () => {
  setCurrentUser(null);
  if (window.google?.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }
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

renderAuthUI();
initGoogleSignIn();
