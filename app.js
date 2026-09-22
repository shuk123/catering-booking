const monthLabel = document.getElementById("monthLabel");
const monthPicker = document.getElementById("monthPicker");
const monthSelect = document.getElementById("monthSelect");
const yearSelect = document.getElementById("yearSelect");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const bookingList = document.getElementById("bookingList");

const overlay = document.getElementById("overlay");
const modalTitle = document.getElementById("modalTitle");
const bookingForm = document.getElementById("bookingForm");
const bookingDateInput = document.getElementById("bookingDate");
const clientNameInput = document.getElementById("clientName");
const venueInput = document.getElementById("venue");
const venueOtherInput = document.getElementById("venueOther");
const venueSlots = document.getElementById("venueSlots");
const slotCheckboxes = document.getElementById("slotCheckboxes");
const notesInput = document.getElementById("notes");
const saveBtn = document.getElementById("bookingForm").querySelector('button[type="submit"]');

const closeModalBtn = document.getElementById("closeModal");
const cancelFormBtn = document.getElementById("cancelForm");
const deleteBookingBtn = document.getElementById("deleteBooking");

const todayStr = toDateStr(new Date());

// If arriving from the bookings list ("Edit" link with ?date=YYYY-MM-DD),
// jump straight to that month/date instead of the current one.
const requestedDate = new URLSearchParams(window.location.search).get("date");
const initialDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayStr;

let viewYear, viewMonth; // viewMonth is 0-indexed
{
  const [y, m] = initialDate.split("-").map(Number);
  viewYear = y;
  viewMonth = m - 1;
}

let selectedDate = initialDate;
let editingId = null;

function onBookingsUpdated() {
  renderCalendar();
  renderDayPanel();
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Populate the month/year picker once, up front.
MONTH_NAMES.forEach((name, i) => {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = name;
  monthSelect.appendChild(opt);
});
{
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 10; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }
}

function openMonthPicker() {
  monthSelect.value = viewMonth;
  yearSelect.value = viewYear;
  monthLabel.classList.add("hidden");
  monthPicker.classList.remove("hidden");
}

function closeMonthPicker() {
  monthPicker.classList.add("hidden");
  monthLabel.classList.remove("hidden");
}

monthLabel.addEventListener("click", openMonthPicker);

function applyMonthYearSelection() {
  viewMonth = Number(monthSelect.value);
  viewYear = Number(yearSelect.value);
  renderCalendar();
  closeMonthPicker();
}

monthSelect.addEventListener("change", applyMonthYearSelection);
yearSelect.addEventListener("change", applyMonthYearSelection);

document.addEventListener("click", (e) => {
  if (!monthPicker.classList.contains("hidden") && !monthPicker.contains(e.target) && e.target !== monthLabel) {
    closeMonthPicker();
  }
});

function renderCalendar() {
  monthLabel.textContent = `${MONTH_NAMES[viewMonth]} ${viewYear}`;
  calendarGrid.innerHTML = "";

  const countsByDate = bookings.reduce((acc, b) => {
    acc[b.date] = (acc[b.date] || 0) + 1;
    return acc;
  }, {});

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  // getDay() is 0=Sun..6=Sat; shift so the grid (Mon..Sun columns) starts
  // on Monday, putting the Sat/Sun weekend together at the right edge.
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(viewYear, viewMonth, day);
    const dateStr = toDateStr(dateObj);
    const dow = dateObj.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dow === 0 || dow === 6;

    const cell = document.createElement("div");
    cell.className = `day-cell ${isWeekend ? "weekend" : "weekday"}`;
    if (dateStr === todayStr) cell.classList.add("today");
    if (dateStr === selectedDate) cell.classList.add("selected");

    const num = document.createElement("span");
    num.textContent = day;
    cell.appendChild(num);

    if (countsByDate[dateStr]) {
      cell.classList.add("has-booking");
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

function buildBookingCard(b) {
  const li = document.createElement("li");
  li.className = "booking-item";
  li.innerHTML = `
    <div class="booking-info">
      <div class="client">${escapeHtml(b.clientName)}</div>
      ${b.timeSlots ? `<div class="slot-preview">${escapeHtml(formatTimeSlots(b.timeSlots, b.venue))}</div>` : ""}
      ${b.notes ? `<div class="notes-preview">${escapeHtml(b.notes)}</div>` : ""}
      ${b.createdBy ? `<div class="created-by">Booked by ${escapeHtml(b.createdBy)}</div>` : ""}
    </div>
    <button type="button" class="edit-btn">Edit</button>
  `;
  li.querySelector(".edit-btn").addEventListener("click", () => {
    if (!requireSignIn()) return;
    openModal(selectedDate, b);
  });
  return li;
}

function renderDayPanel() {
  selectedDateLabel.textContent = formatLongDate(selectedDate);
  const dayBookings = bookings.filter(b => b.date === selectedDate);

  bookingList.innerHTML = "";

  if (dayBookings.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No bookings for this date.";
    bookingList.appendChild(empty);
  } else {
    // Presets first (in their usual order), then any other venue names
    // encountered that day, alphabetically.
    const otherVenues = Array.from(new Set(dayBookings.map(b => b.venue)))
      .filter(v => !PRESET_VENUES.includes(v))
      .sort((a, b) => a.localeCompare(b));
    const venueOrder = [...PRESET_VENUES, ...otherVenues];

    venueOrder.forEach(venue => {
      const groupBookings = dayBookings
        .filter(b => b.venue === venue)
        .sort((a, b) => a.clientName.localeCompare(b.clientName));
      if (groupBookings.length === 0) return;

      const group = document.createElement("li");
      group.className = `venue-group ${colorClassForVenue(venue)}`;

      const available = availableSlotsForVenue(venue, groupBookings);
      let availabilityHtml = "";
      if (available !== null) {
        availabilityHtml = available.length === 0
          ? `<span class="venue-badge">Fully Booked</span>`
          : `<span class="venue-available">Available: ${escapeHtml(available.map(s => s.label.split(" (")[0]).join(", "))}</span>`;
      }

      const heading = document.createElement("div");
      heading.className = "venue-heading";
      heading.innerHTML = `
        <span class="venue-name">${escapeHtml(venue)}</span>
        ${availabilityHtml}
      `;
      group.appendChild(heading);

      const itemsList = document.createElement("ul");
      itemsList.className = "venue-group-items";
      groupBookings.forEach(b => itemsList.appendChild(buildBookingCard(b)));
      group.appendChild(itemsList);

      bookingList.appendChild(group);
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

  const selectedSlots = booking?.timeSlots ? booking.timeSlots.split(",").map(s => s.trim()) : [];
  renderSlotCheckboxes(booking ? booking.venue : venueInput.value, selectedSlots);

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
  renderSlotCheckboxes("", []);
  editingId = null;
}

function currentVenueValue() {
  return venueInput.value === "__other__" ? venueOtherInput.value.trim() : venueInput.value.trim();
}

// (Re)builds the slot checkboxes for whichever venue is selected — each
// venue has its own slot set (or none), so the checkboxes can't be static.
function renderSlotCheckboxes(venue, selectedIds) {
  const slots = slotsForVenue(venue);
  slotCheckboxes.innerHTML = "";
  slots.forEach(slot => {
    const label = document.createElement("label");
    label.className = "slot-checkbox";
    label.innerHTML = `<input type="checkbox" class="slot-input" value="${slot.id}"> ${escapeHtml(slot.label)}`;
    label.querySelector("input").checked = selectedIds.includes(slot.id);
    slotCheckboxes.appendChild(label);
  });
  venueSlots.classList.toggle("hidden", slots.length === 0);
}

// Keeps a "Time slot(s): ..." line at the top of Notes in sync with the
// checked boxes, without touching whatever else the person has typed below.
function syncNotesWithSlots() {
  const lines = notesInput.value.split("\n");
  if (lines[0]?.startsWith("Time slot(s):")) {
    lines.shift();
    if (lines[0] === "") lines.shift();
  }
  const rest = lines.join("\n");

  const checked = Array.from(slotCheckboxes.querySelectorAll(".slot-input"))
    .filter(input => input.checked).map(input => input.value);
  const slotLine = checked.length ? `Time slot(s): ${formatTimeSlots(checked.join(","), currentVenueValue())}` : "";

  notesInput.value = slotLine ? (rest ? `${slotLine}\n\n${rest}` : slotLine) : rest;
}

slotCheckboxes.addEventListener("change", (e) => {
  if (e.target.classList.contains("slot-input")) syncNotesWithSlots();
});

venueInput.addEventListener("change", () => {
  const isOther = venueInput.value === "__other__";
  venueOtherInput.classList.toggle("hidden", !isOther);
  venueOtherInput.required = isOther;
  venueOtherInput.disabled = !isOther;
  if (isOther) {
    venueOtherInput.value = "";
    venueOtherInput.focus();
  }

  renderSlotCheckboxes(venueInput.value, []);
  syncNotesWithSlots();
});

bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const venue = currentVenueValue();

  const timeSlots = Array.from(slotCheckboxes.querySelectorAll(".slot-input"))
    .filter(input => input.checked).map(input => input.value).join(",");

  const data = {
    date: bookingDateInput.value,
    clientName: clientNameInput.value.trim(),
    venue,
    notes: notesInput.value.trim(),
    timeSlots,
  };

  if (!data.date || !data.clientName || !data.venue) return;
  if (!requireSignIn()) return;

  saveBtn.disabled = true;
  setStatus("Saving…");
  try {
    if (editingId) {
      await postToApi({ action: "update", booking: { id: editingId, ...data } });
    } else {
      await postToApi({ action: "create", booking: data });
    }
    selectedDate = data.date;
    closeModal();
    await refreshBookings();
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
    await refreshBookings();
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

renderCalendar();
renderDayPanel();
refreshBookings();
