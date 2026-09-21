const monthLabel = document.getElementById("monthLabel");
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
