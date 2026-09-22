const filterButtons = document.querySelectorAll(".filter-btn");
const tableBody = document.getElementById("bookingsTableBody");
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

function onBookingsUpdated() {
  renderTable();
}

function renderTable() {
  const rows = bookings
    .filter(matchesFilter)
    .sort((a, b) => a.date.localeCompare(b.date) || a.clientName.localeCompare(b.clientName));

  tableBody.innerHTML = "";
  emptyState.classList.toggle("hidden", rows.length > 0);

  rows.forEach(b => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatShortDate(b.date)}</td>
      <td>${escapeHtml(b.clientName)}</td>
      <td>${escapeHtml(b.venue)}</td>
      <td>${b.timeSlots ? escapeHtml(formatTimeSlots(b.timeSlots)) : "—"}</td>
      <td class="notes-cell">${b.notes ? escapeHtml(b.notes) : "—"}</td>
      <td>${b.createdBy ? escapeHtml(b.createdBy) : "—"}</td>
      <td><a class="btn ghost table-edit-link" href="index.html?date=${encodeURIComponent(b.date)}">Edit</a></td>
    `;
    tableBody.appendChild(tr);
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
