const monthLabel = document.getElementById("monthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const bookingList = document.getElementById("bookingList");
const syncStatus = document.getElementById("syncStatus");

const overlay = document.getElementById("overlay");
const modalTitle = document.getElementById("modalTitle");
const bookingForm = document.getElementById("bookingForm");
const bookingDateInput = document.getElementById("bookingDate");
const clientNameInput = document.getElementById("clientName");
const venueInput = document.getElementById("venue");
const venueOtherInput = document.getElementById("venueOther");
const notesInput = document.getElementById("notes");
const saveBtn = document.getElementById("bookingForm").querySelector('button[type="submit"]');

const PRESET_VENUES = ["Ibunda Garden Hall", "Ibunda Mini Hall", "CSH A"];
const closeModalBtn = document.getElementById("closeModal");
const cancelFormBtn = document.getElementById("cancelForm");
const deleteBookingBtn = document.getElementById("deleteBooking");

const googleSignInBtnContainer = document.getElementById("googleSignInBtn");
const signedInAsEl = document.getElementById("signedInAs");
const userEmailLabel = document.getElementById("userEmailLabel");
const signOutBtn = document.getElementById("signOutBtn");

const todayStr = toDateStr(new Date());

let viewYear, viewMonth; // viewMonth is 0-indexed
{
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
}

let selectedDate = todayStr;
let editingId = null;
let bookings = [];

function setStatus(message, isError) {
  syncStatus.textContent = message;
  syncStatus.classList.toggle("error", !!isError);
}

// --- Google Sign-In -------------------------------------------------
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

async function fetchBookings() {
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
  renderCalendar();
  renderDayPanel();
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

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function renderCalendar() {
  monthLabel.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  calendarGrid.innerHTML = "";

  const countsByDate = bookings.reduce((acc, b) => {
    acc[b.date] = (acc[b.date] || 0) + 1;
    return acc;
  }, {});

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = toDateStr(new Date(viewYear, viewMonth, day));
    const cell = document.createElement("div");
    cell.className = "day-cell";
    if (dateStr === todayStr) cell.classList.add("today");
    if (dateStr === selectedDate) cell.classList.add("selected");

    const num = document.createElement("span");
    num.textContent = day;
    cell.appendChild(num);

    if (countsByDate[dateStr]) {
      const dot = document.createElement("span");
      dot.className = "dot";
      cell.appendChild(dot);
    }

    cell.addEventListener("click", () => {
      selectedDate = dateStr;
      renderCalendar();
      renderDayPanel();
    });

    calendarGrid.appendChild(cell);
  }
}

function renderDayPanel() {
  selectedDateLabel.textContent = formatLongDate(selectedDate);
  const dayBookings = bookings
    .filter(b => b.date === selectedDate)
    .sort((a, b) => a.clientName.localeCompare(b.clientName));

  bookingList.innerHTML = "";

  if (dayBookings.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No bookings for this date.";
    bookingList.appendChild(empty);
  } else {
    dayBookings.forEach(b => {
      const li = document.createElement("li");
      li.className = "booking-item";
      li.innerHTML = `
        <div class="booking-info">
          <div class="client">${escapeHtml(b.clientName)}</div>
          <div class="venue">${escapeHtml(b.venue)}</div>
          ${b.notes ? `<div class="notes-preview">${escapeHtml(b.notes)}</div>` : ""}
          ${b.createdBy ? `<div class="created-by">Booked by ${escapeHtml(b.createdBy)}</div>` : ""}
        </div>
        <button type="button" class="edit-btn">Edit</button>
      `;
      li.querySelector(".edit-btn").addEventListener("click", () => {
        if (!requireSignIn()) return;
        openModal(selectedDate, b);
      });
      bookingList.appendChild(li);
    });
  }

  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.textContent = "+ Add booking for this date";
  addBtn.addEventListener("click", () => {
    if (!requireSignIn()) return;
    openModal(selectedDate, null);
  });
  bookingList.appendChild(addBtn);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function openModal(dateStr, booking) {
  editingId = booking ? booking.id : null;
  modalTitle.textContent = booking ? "Edit Booking" : "New Booking";
  bookingDateInput.value = dateStr;
  clientNameInput.value = booking ? booking.clientName : "";

  if (booking && !PRESET_VENUES.includes(booking.venue)) {
    venueInput.value = "__other__";
    venueOtherInput.value = booking.venue;
    venueOtherInput.classList.remove("hidden");
    venueOtherInput.required = true;
    venueOtherInput.disabled = false;
  } else {
    venueInput.value = booking ? booking.venue : "";
    venueOtherInput.value = "";
    venueOtherInput.classList.add("hidden");
    venueOtherInput.required = false;
    venueOtherInput.disabled = true;
  }

  notesInput.value = booking ? booking.notes : "";
  deleteBookingBtn.classList.toggle("hidden", !booking);
  overlay.classList.remove("hidden");
  clientNameInput.focus();
}

function closeModal() {
  overlay.classList.add("hidden");
  bookingForm.reset();
  venueOtherInput.classList.add("hidden");
  venueOtherInput.required = false;
  venueOtherInput.disabled = true;
  editingId = null;
}

venueInput.addEventListener("change", () => {
  const isOther = venueInput.value === "__other__";
  venueOtherInput.classList.toggle("hidden", !isOther);
  venueOtherInput.required = isOther;
  venueOtherInput.disabled = !isOther;
  if (isOther) {
    venueOtherInput.value = "";
    venueOtherInput.focus();
  }
});

bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const venue = venueInput.value === "__other__"
    ? venueOtherInput.value.trim()
    : venueInput.value.trim();

  const data = {
    date: bookingDateInput.value,
    clientName: clientNameInput.value.trim(),
    venue,
    notes: notesInput.value.trim(),
  };

  if (!data.date || !data.clientName || !data.venue) return;
  if (!requireSignIn()) return;

  saveBtn.disabled = true;
  setStatus("Saving…");
  try {
    if (editingId) {
      await postToApi({ action: "update", booking: { id: editingId, ...data } });
    } else {
      await postToApi({ action: "create", booking: { ...data, createdBy: currentUser.email } });
    }
    selectedDate = data.date;
    closeModal();
    await fetchBookings();
  } catch (err) {
    setStatus(`Could not save booking: ${err.message}`, true);
  } finally {
    saveBtn.disabled = false;
  }
});

deleteBookingBtn.addEventListener("click", async () => {
  if (!editingId) return;
  deleteBookingBtn.disabled = true;
  setStatus("Deleting…");
  try {
    await postToApi({ action: "delete", id: editingId });
    closeModal();
    await fetchBookings();
  } catch (err) {
    setStatus(`Could not delete booking: ${err.message}`, true);
  } finally {
    deleteBookingBtn.disabled = false;
  }
});

closeModalBtn.addEventListener("click", closeModal);
cancelFormBtn.addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});

prevMonthBtn.addEventListener("click", () => {
  viewMonth--;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  viewMonth++;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderCalendar();
});

renderAuthUI();
initGoogleSignIn();
renderCalendar();
renderDayPanel();
fetchBookings();
