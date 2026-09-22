const notAuthorizedEl = document.getElementById("notAuthorized");
const adminPanel = document.getElementById("adminPanel");
const addUserForm = document.getElementById("addUserForm");
const newUserEmailInput = document.getElementById("newUserEmail");
const newUserRoleSelect = document.getElementById("newUserRole");
const userList = document.getElementById("userList");
const userListEmpty = document.getElementById("userListEmpty");

function isAdminUser() {
  return !!currentUser && ADMIN_EMAILS.includes(currentUser.email);
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
    renderUsers(result.users || []);
    setStatus("");
  } catch (err) {
    setStatus(`Could not load staff list: ${err.message}`, true);
  }
}

function renderUsers(users) {
  userList.innerHTML = "";
  userListEmpty.classList.toggle("hidden", users.length > 0);
  users.forEach(user => {
    const li = document.createElement("li");
    li.className = "user-item";
    li.innerHTML = `
      <span>${escapeHtml(user.email)}</span>
      <select class="role-select" aria-label="Access level for ${escapeHtml(user.email)}">
        <option value="staff">Staff (can add/edit)</option>
        <option value="viewer">Viewer (view only)</option>
      </select>
      <button type="button" class="btn danger">Remove</button>
    `;
    li.querySelector(".role-select").value = user.role;
    li.querySelector(".role-select").addEventListener("change", (e) => setUserRole(user.email, e.target.value));
    li.querySelector("button").addEventListener("click", () => removeUser(user.email));
    userList.appendChild(li);
  });
}

async function setUserRole(email, role) {
  setStatus("Updating access…");
  try {
    await postToApi({ action: "addUser", email, role });
    await loadUsers();
  } catch (err) {
    setStatus(`Could not update ${email}: ${err.message}`, true);
  }
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
    await postToApi({ action: "addUser", email, role: newUserRoleSelect.value });
    newUserEmailInput.value = "";
    newUserRoleSelect.value = "staff";
    await loadUsers();
  } catch (err) {
    setStatus(`Could not add ${email}: ${err.message}`, true);
  }
});

onAuthChanged();
