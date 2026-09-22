const filterButtons = document.querySelectorAll(".filter-btn");
const bookingsContainer = document.getElementById("bookingsContainer");
const emptyState = document.getElementById("emptyState");

let currentFilter = "all";

function matchesFilter(booking) {
  if (currentFilter === "all") return true;
  if (currentFilter === "others") return !PRESET_VENUES.includes(booking.venue);
  return booking.venue === currentFilter;
}

function formatShortDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
      <td>${b.createdBy ? escapeHtml(b.createdBy) : "—"}</td>
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

refreshBookings();
