const filterButtons = document.querySelectorAll(".filter-btn");
const bookingsContainer = document.getElementById("bookingsContainer");
const emptyState = document.getElementById("emptyState");
const printView = document.getElementById("printView");
const printBtn = document.getElementById("printBtn");
const printMonthSelect = document.getElementById("printMonthSelect");
const printVenueSelect = document.getElementById("printVenueSelect");
const printOverlay = document.getElementById("printOverlay");
const closePrintModal = document.getElementById("closePrintModal");
const cancelPrintModal = document.getElementById("cancelPrintModal");
const confirmPrintBtn = document.getElementById("confirmPrintBtn");

let currentFilter = "all";

function matchesFilter(booking) {
  if (currentFilter === "all") return true;
  if (currentFilter === "others") return !PRESET_VENUES.includes(booking.venue);
  return booking.venue === currentFilter;
}

const MALAY_DAYS = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"]; // index 0 = Sunday

function formatShortDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = MALAY_DAYS[date.getDay()];
  const rest = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return `${dayName}, ${rest}`;
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function onBookingsUpdated() {
  renderTable();
  populatePrintMonthOptions();
}

// Keeps the print month dropdown in sync with whatever months actually
// have bookings, preserving the current selection if it's still valid.
function populatePrintMonthOptions() {
  const previousValue = printMonthSelect.value;
  const keys = Array.from(new Set(bookings.map(b => monthKey(b.date)))).sort();
  printMonthSelect.innerHTML = `<option value="all">All months</option>` +
    keys.map(k => `<option value="${k}">${escapeHtml(monthLabel(k))}</option>`).join("");
  if (keys.includes(previousValue)) printMonthSelect.value = previousValue;
}

function buildMonthTable(rows) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.innerHTML = `
    <table class="bookings-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Client</th>
          <th>Venue</th>
          <th>Slot</th>
          <th>Notes</th>
          <th>Booked by</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  const tbody = wrap.querySelector("tbody");
  rows.forEach(b => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatShortDate(b.date)}</td>
      <td>${escapeHtml(b.clientName)}</td>
      <td>${escapeHtml(b.venue)}</td>
      <td>${b.timeSlots ? escapeHtml(formatTimeSlots(b.timeSlots, b.venue)) : "—"}</td>
      <td class="notes-cell">${b.notes ? escapeHtml(b.notes) : "—"}</td>
      <td>${firstName(b) ? escapeHtml(firstName(b)) : "—"}</td>
      <td><a class="btn ghost table-edit-link" href="index.html?date=${encodeURIComponent(b.date)}">Edit</a></td>
    `;
    tbody.appendChild(tr);
  });
  return wrap;
}

function renderTable() {
  const rows = bookings
    .filter(matchesFilter)
    .sort((a, b) => a.date.localeCompare(b.date) || a.clientName.localeCompare(b.clientName));

  bookingsContainer.innerHTML = "";
  emptyState.classList.toggle("hidden", rows.length > 0);

  const groups = new Map();
  rows.forEach(b => {
    const key = monthKey(b.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  });

  groups.forEach((groupRows, key) => {
    const section = document.createElement("div");
    section.className = "month-group";

    const heading = document.createElement("h3");
    heading.className = "month-heading";
    heading.textContent = monthLabel(key);
    section.appendChild(heading);

    section.appendChild(buildMonthTable(groupRows));
    bookingsContainer.appendChild(section);
  });
}

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.venue;
    filterButtons.forEach(b => b.classList.toggle("active", b === btn));
    renderTable();
  });
});

// The print/PDF layout groups by month, then by venue (colored) within
// each month, and each month starts on its own printed page. It respects
// the "Month to print" / "Venue to print" selectors, independent of the
// on-screen filter buttons.
function buildPrintTable(rows) {
  const table = document.createElement("table");
  table.className = "print-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Date</th>
        <th>Client</th>
        <th>Slot</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  rows.forEach(b => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatShortDate(b.date)}</td>
      <td>${escapeHtml(b.clientName)}</td>
      <td>${b.timeSlots ? escapeHtml(formatTimeSlots(b.timeSlots, b.venue)) : "—"}</td>
      <td>${b.notes ? escapeHtml(b.notes) : "—"}</td>
    `;
    tbody.appendChild(tr);
  });
  return table;
}

function printVenueMatches(booking, venueFilterValue) {
  if (venueFilterValue === "all") return true;
  if (venueFilterValue === "others") return !PRESET_VENUES.includes(booking.venue);
  return booking.venue === venueFilterValue;
}

function buildPrintHeader() {
  const header = document.createElement("div");
  header.className = "print-header";
  header.innerHTML = `
    <img src="assets/logo.jpg" alt="Ibunda Catering, Wedding & Event">
    <h1>Ibunda Booking</h1>
  `;
  return header;
}

function buildPrintView() {
  printView.innerHTML = "";

  const monthFilter = printMonthSelect.value;
  const venueFilter = printVenueSelect.value;
  const filtered = bookings.filter(b =>
    (monthFilter === "all" || monthKey(b.date) === monthFilter) &&
    printVenueMatches(b, venueFilter));

  const sorted = filtered.sort((a, b) =>
    a.date.localeCompare(b.date) || a.clientName.localeCompare(b.clientName));

  const monthGroups = new Map();
  sorted.forEach(b => {
    const key = monthKey(b.date);
    if (!monthGroups.has(key)) monthGroups.set(key, []);
    monthGroups.get(key).push(b);
  });

  if (monthGroups.size === 0) {
    printView.appendChild(buildPrintHeader());
    const empty = document.createElement("p");
    empty.textContent = "No bookings to print.";
    printView.appendChild(empty);
    return;
  }

  monthGroups.forEach((monthRows, key) => {
    const monthSection = document.createElement("section");
    monthSection.className = "print-month";

    // Repeated on every month section (= every printed page), since plain
    // CSS has no reliable way to repeat arbitrary content across print
    // pages the way a <thead> repeats for a single long table.
    monthSection.appendChild(buildPrintHeader());

    const monthHeading = document.createElement("h2");
    monthHeading.className = "print-month-heading";
    monthHeading.textContent = monthLabel(key);
    monthSection.appendChild(monthHeading);

    const otherVenues = Array.from(new Set(monthRows.map(b => b.venue)))
      .filter(v => !PRESET_VENUES.includes(v))
      .sort((a, b) => a.localeCompare(b));
    const venueOrder = [...PRESET_VENUES, ...otherVenues];

    venueOrder.forEach(venue => {
      const venueRows = monthRows.filter(b => b.venue === venue);
      if (venueRows.length === 0) return;

      const venueSection = document.createElement("div");
      venueSection.className = `print-venue ${colorClassForVenue(venue)}`;

      const venueHeading = document.createElement("h3");
      venueHeading.className = "print-venue-heading";
      venueHeading.textContent = venue;
      venueSection.appendChild(venueHeading);

      venueSection.appendChild(buildPrintTable(venueRows));
      monthSection.appendChild(venueSection);
    });

    printView.appendChild(monthSection);
  });
}

printBtn.addEventListener("click", () => {
  printOverlay.classList.remove("hidden");
});

closePrintModal.addEventListener("click", () => printOverlay.classList.add("hidden"));
cancelPrintModal.addEventListener("click", () => printOverlay.classList.add("hidden"));
printOverlay.addEventListener("click", (e) => {
  if (e.target === printOverlay) printOverlay.classList.add("hidden");
});

confirmPrintBtn.addEventListener("click", () => {
  buildPrintView();
  printOverlay.classList.add("hidden");
  window.print();
});

refreshBookings();
