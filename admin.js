const notAuthorizedEl = document.getElementById("notAuthorized");
const adminPanel = document.getElementById("adminPanel");
const addUserForm = document.getElementById("addUserForm");
const newUserEmailInput = document.getElementById("newUserEmail");
const userList = document.getElementById("userList");
const userListEmpty = document.getElementById("userListEmpty");

function isAdminUser() {
  return !!currentUser && currentUser.email === ADMIN_EMAIL;
}

// Called by shared.js whenever sign-in state changes.
function onAuthChanged() {
  const admin = isAdminUser();
  notAuthorizedEl.classList.toggle("hidden", admin);
  adminPanel.classList.toggle("hidden", !admin);
  if (admin) loadUsers();
}

async function loadUsers() {
  setStatus("Loading staff list…");
  try {
    const result = await postToApi({ action: "listUsers" });
    renderUsers(result.emails || []);
    setStatus("");
  } catch (err) {
    setStatus(`Could not load staff list: ${err.message}`, true);
  }
}

function renderUsers(emails) {
  userList.innerHTML = "";
  userListEmpty.classList.toggle("hidden", emails.length > 0);
  emails.forEach(email => {
    const li = document.createElement("li");
    li.className = "user-item";
    li.innerHTML = `
      <span>${escapeHtml(email)}</span>
      <button type="button" class="btn danger">Remove</button>
    `;
    li.querySelector("button").addEventListener("click", () => removeUser(email));
    userList.appendChild(li);
  });
}

async function removeUser(email) {
  setStatus("Removing…");
  try {
    await postToApi({ action: "removeUser", email });
    await loadUsers();
  } catch (err) {
    setStatus(`Could not remove ${email}: ${err.message}`, true);
  }
}

addUserForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = newUserEmailInput.value.trim();
  if (!email) return;
  setStatus("Adding…");
  try {
    await postToApi({ action: "addUser", email });
    newUserEmailInput.value = "";
    await loadUsers();
  } catch (err) {
    setStatus(`Could not add ${email}: ${err.message}`, true);
  }
});

onAuthChanged();
