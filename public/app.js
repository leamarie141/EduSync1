// Helpers
let cachedNotes = [];
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const API_BASE = "https://edusync-s4z1.onrender.com";

const api = {
  get: (url) =>
    fetch(API_BASE + url, {  credentials: "include" })
    .then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    }),
  post: (url, body) =>
    fetch(API_BASE + url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include"
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json(); 
    }),
  put: (url, body) =>
    fetch(API_BASE + url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include"
    }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    }),
  del: (url) =>
    fetch(API_BASE + url, { method: "DELETE",  credentials: "include" }).then((r) => {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    }),
};

// Mount
document.addEventListener("DOMContentLoaded", async () => {
  // Detect dashboard by element presence (works for /app too)
  const isDashboard = !!document.getElementById("view-dashboard");
  if (!isDashboard) initLanding();
  else initDashboard();
});

/* Landing page logic */
function initLanding() {
  function showLayer(which) {
    (which === "login" ? qs("#layer-login") : qs("#layer-register")).classList.add("show");
  }
  function hideLayer(which) {
    (which === "login" ? qs("#layer-login") : qs("#layer-register")).classList.remove("show");
  }

  qs("#btn-login-open")?.addEventListener("click", () => showLayer("login"));
  qs("#btn-register-open")?.addEventListener("click", () => showLayer("register"));
  qs("#btn-login-hero")?.addEventListener("click", () => showLayer("login"));

  qs("#btn-get-started")?.addEventListener("click", async () => {
    const me = await api.get("/api/user/me").catch(() => null);
    if (me && me.userId) location.href = "/app";
    else showLayer("register");
  });

  qsa(".layer-close").forEach((b) => {
    b.addEventListener("click", () => hideLayer(b.dataset.close));
  });
  qs("#switch-to-register")?.addEventListener("click", () => {
    hideLayer("login");
    showLayer("register");
  });
  qs("#switch-to-login")?.addEventListener("click", () => {
    hideLayer("register");
    showLayer("login");
  });

  qs("#form-login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const res = await api
      .post("/api/auth/login", {
        email: form.get("email"),
        password: form.get("password"),
      })
      .catch((err) => ({ error: err.message }));
    if (res.error) return alert(res.error);
    location.href = "/app";
  });

  qs("#form-register")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    if (!qs("#agree").checked) return alert("Please agree to Terms & Conditions");
    const res = await api
      .post("/api/auth/register", {
        name: form.get("name"),
        username: form.get("username"),
        email: form.get("email"),
        password: form.get("password"),
        studentId: "S1121",
      })
      .catch((err) => ({ error: err.message }));
    if (res.error) return alert(res.error);
    qs("#modal-verify").classList.remove("hidden");
  });

  qs("#verify-submit")?.addEventListener("click", async () => {
    const code = qs("#verify-code").value.trim();
    const email = qs("#form-register [name='email']").value.trim();
  
    const res = await api.post("/api/auth/verify", { email, code })
      .catch((err) => ({ error: err.message }));
  
    if (res.error) return alert(res.error);
  
    alert("Email verified successfully!");
    location.href = "/app"; // proceed to dashboard
  });
  
  qs("#verify-cancel")?.addEventListener("click", () => {
    qs("#modal-verify").classList.add("hidden");
  });
}

/* Dashboard logic */
async function initDashboard() {
  const sidebar = qs("#sidebar");
  qs("#toggle-sidebar")?.addEventListener("click", () => {
    sidebar.classList.toggle("hidden");
  });


  // UI bindings
  qs("#user-chip").textContent = me.username || me.name;
  qs("#profile-mini-name").textContent = me.name;

  qsa(".nav-btn").forEach((btn) =>
    btn.addEventListener("click", () => switchView(btn.dataset.view, btn))
  );

  qs("#logout")?.addEventListener("click", async () => {
    await api.post("/api/auth/logout", {});
    location.href = "/";
  });

  // Section-path buttons (Home -> dashboard, Profile -> profile layer)
  qsa(".section-path [data-nav]").forEach((b) => {
    b.addEventListener("click", () => {
      const dest = b.dataset.nav;
      if (dest === "home") switchView("dashboard", qs('[data-view="dashboard"]'));
      if (dest === "profile") qs("#view-profile").click();
    });
  });

  // Profile layer open
qs("#view-profile")?.addEventListener("click", async () => {
  try {
    const prof = await api.get("/api/profile");

    // Fill dynamic values (use bypass ID from 'me' if that's your dev source)
    if (me?.userId) {
      qs("#user-id-profile-layer").textContent = `User ID: ${me.userId}`;
    } else if (prof?.id) {
      qs("#user-id-profile-layer").textContent = `User ID: ${prof.id}`;
    } else {
      qs("#user-id-profile-layer").textContent = "User ID: —";
    }

    qs("#profile-name-layer").value = prof?.fullName ?? me?.name ?? "";
    qs("#profile-email-layer").value = prof?.email ?? me?.email ?? "";
    qs("#profile-student-layer").value = prof?.studentId ?? me?.studentId ?? "S1121";

    // Display name/program at top (only if those elements exist)
    const nameEl = qs("#profile-display-name-layer");
    if (nameEl) nameEl.textContent = prof?.fullName ?? me?.name ?? "New User";

    const progEl = qs("#profile-display-program-layer");
    if (progEl) progEl.textContent = prof?.program ?? "Unassigned Program";

    qs("#layer-profile").classList.add("show");
  } catch (err) {
    console.error("Failed to load profile:", err);
    alert("Could not load profile. Please try again.");
  }
});

// Profile layer close
qs("#close-profile-layer")?.addEventListener("click", () => {
  qs("#layer-profile").classList.remove("show");
});

// Save profile changes
qs("#save-profile-layer")?.addEventListener("click", async () => {
  try {
    const fullName = qs("#profile-name-layer").value.trim();
    const email = qs("#profile-email-layer").value.trim();
    const studentId = qs("#profile-student-layer").value.trim();

    const updated = await api.put("/api/profile", { fullName, email, studentId });

    // Update UI chips only if present
    const chip = qs("#user-chip");
    if (chip) chip.textContent = updated?.fullName ?? fullName;

    const mini = qs("#profile-mini-name");
    if (mini) mini.textContent = updated?.fullName ?? fullName;

    alert("Profile updated!");
  } catch (err) {
    console.error("Failed to save profile:", err);
    alert("Could not save changes. Please try again.");
  }
});

// Profile picture preview
qs("#profile-upload-layer")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = qs("#profile-preview-layer");
    if (img) img.src = reader.result;

    const chipImg = qs("#user-chip-img");
    if (chipImg) chipImg.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// Change password
qs("#change-password-layer")?.addEventListener("click", async () => {
  const newPass = prompt("Enter new password:");
  if (!newPass) return;

  try {
    await api.put("/api/profile/password", { password: newPass });
    alert("Password updated!");
  } catch (err) {
    console.error("Failed to update password:", err);
    alert("Could not update password. Please try again.");
  }
});

// Switch to edit mode
qs("#edit-profile")?.addEventListener("click", () => {
  qs("#profile-readonly")?.classList.add("hidden");
  qs("#profile-edit")?.classList.remove("hidden");

  // Pre-fill edit inputs with current values
  qs("#profile-name-layer").value = qs("#profile-display-name-layer")?.textContent || "";
  qs("#profile-email-layer").value = qs("#profile-display-email-layer")?.textContent || "";
  qs("#profile-student-layer").value = qs("#profile-display-student-layer")?.textContent || "";
});

// Cancel edit → back to read-only
qs("#cancel-edit-layer")?.addEventListener("click", () => {
  qs("#profile-edit")?.classList.add("hidden");
  qs("#profile-readonly")?.classList.remove("hidden");
});

// Save changes
qs("#save-profile-layer")?.addEventListener("click", async () => {
  const fullName = qs("#profile-name-layer").value.trim();
  const email = qs("#profile-email-layer").value.trim();
  const studentId = qs("#profile-student-layer").value.trim();

  const updated = await api.put("/api/profile", { fullName, email, studentId });

  // Update read-only display
  qs("#profile-display-name-layer").textContent = updated.fullName;
  qs("#profile-display-email-layer").textContent = updated.email;
  qs("#profile-display-student-layer").textContent = updated.studentId;
  qs("#profile-display-program-layer").textContent = updated.program || "Unassigned Program";

  // Back to read-only
  qs("#profile-edit").classList.add("hidden");
  qs("#profile-readonly").classList.remove("hidden");
});

  // Quick actions
  qs("#add-note")?.addEventListener("click", () =>
    switchView("notes", qs('[data-view="notes"]'))
  );
  qs("#add-assignment")?.addEventListener("click", () =>
    switchView("study-timer", qs('[data-view="study-timer"]'))
  );
  qs("#add-event")?.addEventListener("click", () =>
    switchView("calendar", qs('[data-view="calendar"]'))
  );
  qs("#add-group")?.addEventListener("click", () =>
    switchView("groups", qs('[data-view="groups"]'))
  );

  // Notes
  qs("#user-id-notes").textContent = `User ID: ${me.userId}`;
  let currentNoteId = null;
  await refreshNotes();

  // Save note -> success layer
  qs("#save-note")?.addEventListener("click", async () => {
    const title = qs("#note-title").value.trim() || "My Note";
    const content = qs("#note-content").value.trim();

    await api.post("/api/notes", { title, content});

    await refreshNotes();
    qs("#layer-success").classList.add("show");
  });

  qs("#success-close")?.addEventListener("click", () => {
    qs("#layer-success").classList.remove("show");
  });

  // Delete note -> confirm layer
  qs("#delete-note")?.addEventListener("click", () => {
    if (!currentNoteId) return alert("No note selected.");
    qs("#layer-delete").classList.add("show");
  });

  qs("#delete-cancel")?.addEventListener("click", () => {
    qs("#layer-delete").classList.remove("show");
  });

  qs("#delete-confirm")?.addEventListener("click", async () => {
    if (!currentNoteId) {
      qs("#layer-delete").classList.remove("show");
      return;
    }
    await api.del(`/api/notes/${currentNoteId}`);
    currentNoteId = null;
    qs("#note-title").value = "My Note";
    qs("#note-content").value = "";
    await refreshNotes();
    qs("#layer-delete").classList.remove("show");
  });

  // Share modal
  qs("#share-note")?.addEventListener("click", () => {
    if (!currentNoteId) return alert("Open a note first.");
    showShareModal(currentNoteId);
  });
  
// Back button
qs("#back-to-notes")?.addEventListener("click", () => {
  switchView("notes", qs('[data-view="notes"]'));
});

// Save in editor
qs("#save-note-editor")?.addEventListener("click", async () => {
  const title = qs("#note-title-editor").value.trim() || "My Note";
  const content = qs("#note-content-editor").value.trim();
  await api.put(`/api/notes/${currentNoteId}`, { title, content });
  await refreshNotes();
  switchView("notes", qs('[data-view="notes"]'));
});

// Delete in editor
qs("#delete-note-editor")?.addEventListener("click", async () => {
  await api.del(`/api/notes/${currentNoteId}`);
  currentNoteId = null;
  await refreshNotes();
  switchView("notes", qs('[data-view="notes"]'));
});

// Share in editor
qs("#share-note-editor")?.addEventListener("click", () => {
  if (!currentNoteId) return alert("Open a note first.");
  showShareModal(currentNoteId);
});



  async function refreshNotes() {
    const notes = await api.get("/api/notes");
    cachedNotes = notes;
    const list = qs("#notes-list");
    list.innerHTML = ""; 
    notes.forEach((n) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
      <div><strong>${n.title}</strong></div>
      <div style="color:#566178">Created: ${new Date(n.createdAt).toLocaleString()}</div>
      
      </div>
      <div class="note-actions">
          <button class="btn-outline" data-act="edit">✏️</button>
          <button class="btn-danger" data-act="delete">🗑️</button>
      </div>
      `;
      // Edit button → go to editor view
div.querySelector('[data-act="edit"]').addEventListener("click", () => {
  currentNoteId = n.id;
  qs("#note-title-editor").value = n.title;
  qs("#note-content-editor").value = n.content;
  switchView("note-editor", qs('[data-view="note-editor"]'));
});

// Delete button → remove note
div.querySelector('[data-act="delete"]').addEventListener("click", async () => {
  await api.del(`/api/notes/${n.id}`);
  currentNoteId = null;
  await refreshNotes();
});

list.appendChild(div); 
     
    });
  }



  function showView(viewId) {
    document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
    document.getElementById(viewId).classList.remove("hidden");
  
    const searchBar = document.getElementById("notes-search-bar");
    if (viewId === "view-notes") {
      searchBar.classList.remove("hidden");
    } else {
      searchBar.classList.add("hidden");
    }
  }
  
  // Search functionality
  document.getElementById("search-notes-btn").addEventListener("click", () => {
    const query = document.getElementById("search-notes").value.toLowerCase();
    
    const filtered = cachedNotes.filter(n =>
      (n.title && n.title.toLowerCase().includes(query)) ||
      ( n.content && n.content.toLowerCase().includes(query))
    );
  
    const list = document.getElementById("notes-list");
    list.innerHTML = "";
   
   if (filtered.length === 0) {
    list.innerHTML = "<p>No notes found.</p>";
    return;
   }  
    
    filtered.forEach(n => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div class="note-content">
          <div><strong>${n.title}</strong></div>
          <div style="color:#566178">Created: ${new Date(n.createdAt).toLocaleString()}</div>
        </div>
        <div class="note-actions">
          <button class="btn-outline" data-act="edit">✏️</button>
          <button class="btn-danger" data-act="delete">🗑️</button>
        </div>
      `;
      list.appendChild(div);
    });
  });
  
 

 

  function showShareModal(noteId) {
    const modal = qs("#modal-share");
    const targets = qs("#share-targets");
    modal.classList.add("show");
    targets.innerHTML = "";

    qsa("#modal-share [data-share]").forEach((btn) => {
      btn.onclick = async () => {
        const type = btn.dataset.share;
        const res = await api.post("/api/share", { type, noteId });
        targets.innerHTML = `
          <div class="share-meta">
            <div style="color:#566178">Share link</div>
            <div><strong>My Note</strong></div>
            <div class="copy-row">
              <a href="${res.url}" target="_blank">${res.url}</a>
              <button class="btn-outline" id="copy-link">Copy link</button>
            </div>
            <div class="qr-box">QR code</div>
            <div style="margin-top:8px; color:#566178">Share using:</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${res.options.map((o) => `<button class="btn-outline">${o}</button>`).join("")}
            </div>
          </div>
        `;
        qs("#copy-link")?.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(res.url);
          } catch {}
        });
      };
    });

    qs("#share-cancel").onclick = () => {
      modal.classList.remove("show");
      targets.innerHTML = "";
    };
  }

// --- Study Timer ---
let timerDuration = 25 * 60; // default 25 min focus
let remaining = timerDuration;
let timerInterval = null;

function updateTimerDisplay() {
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  qs("#timer-display").textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function setMode(mode) {
  clearInterval(timerInterval);
  if (mode === "focus") {
    timerDuration = 25 * 60;
    qs("#timer-label").textContent = "Focus Time";
  } else if (mode === "break") {
    timerDuration = 5 * 60;
    qs("#timer-label").textContent = "Short Break";
  } else if (mode === "long") {
    timerDuration = 15 * 60;
    qs("#timer-label").textContent = "Long Break";
  }
  remaining = timerDuration;
  updateTimerDisplay();
}

// Tab buttons
qs("#tab-focus")?.addEventListener("click", () => {
  setMode("focus");
  qs("#tab-focus").classList.add("active");
  qs("#tab-break").classList.remove("active");
  qs("#tab-long-break").classList.remove("active");
});

qs("#tab-break")?.addEventListener("click", () => {
  setMode("break");
  qs("#tab-break").classList.add("active");
  qs("#tab-focus").classList.remove("active");
  qs("#tab-long-break").classList.remove("active");
});

qs("#tab-long-break")?.addEventListener("click", () => {
  setMode("long");
  qs("#tab-long-break").classList.add("active");
  qs("#tab-focus").classList.remove("active");
  qs("#tab-break").classList.remove("active");
});

// Controls
qs("#btn-start")?.addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (remaining > 0) {
      remaining--;
      updateTimerDisplay();
    } else {
      clearInterval(timerInterval);
      alert("Time's up!");
    }
  }, 1000);
});

qs("#btn-pause")?.addEventListener("click", () => clearInterval(timerInterval));

qs("#btn-reset")?.addEventListener("click", () => {
  remaining = timerDuration;
  updateTimerDisplay();
});

// Initialize
setMode("focus");

  // calendar
  qs("#user-id-calendar").textContent = `User ID: ${me.userId}`;
  let currentMonth = new Date();
  await renderCalendar(currentMonth);

  qs("#prev-month")?.addEventListener("click", async () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    await renderCalendar(currentMonth);
  });

  qs("#next-month")?.addEventListener("click", async () => {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    await renderCalendar(currentMonth);
  });

  qs("#add-event")?.addEventListener("click", () =>
    switchView("calendar", qs('[data-view="calendar"]'))
  );

  qs("#add-event2")?.addEventListener("click", async () => {
    const title = prompt("Event title?");
    if (!title) return;
    const dateStr = prompt("Event date (YYYY-MM-DD)?");
    if (!dateStr) return;
    await api.post("/api/events", { title, date: dateStr });
    await renderCalendar(currentMonth);
    await refreshEventsList();
  });

  qs("#export-pdf")?.addEventListener("click", () => {
    window.print();
  });

  await refreshEventsList();

  async function refreshEventsList() {
    const list = qs("#events-list");
    const events = await api.get("/api/events");
    list.innerHTML = "";
    events.forEach((e) => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div><strong>${e.title}</strong> — ${e.date}</div>
        <button class="btn-danger" data-id="${e.id}">Delete</button>
      `;
      div.querySelector("button").addEventListener("click", async (ev) => {
        await api.del(`/api/events/${ev.target.dataset.id}`);
        await renderCalendar(currentMonth);
        await refreshEventsList();
      });
      list.appendChild(div);
    });
  }

  async function renderCalendar(monthDate) {
    const cal = qs("#calendar");
    const events = await api.get("/api/events");

    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    const dayOfWeek = (first.getDay() + 6) % 7; // Monday=0
    start.setDate(start.getDate() - dayOfWeek);

    const monthLabel = monthDate.toLocaleString("default", { month: "long", year: "numeric" });
    qs("#month-label").textContent = monthLabel;

    cal.innerHTML = "";

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    days.forEach((d) => {
      const head = document.createElement("div");
      head.className = "day-cell";
      head.style.background = "#fff";
      head.innerHTML = `<strong>${d}</strong>`;
      cal.appendChild(head);
    });

    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const cell = document.createElement("div");
      cell.className = "day-cell";
      const dateNum = date.getDate();
      cell.innerHTML = `<div class="date">${dateNum}</div>`;
      const iso = date.toISOString().slice(0, 10);
      events
        .filter((e) => e.date === iso)
        .forEach((e) => {
          const tag = document.createElement("div");
          tag.className = "event-tag";
          tag.textContent = e.title;
          cell.appendChild(tag);
        });
      cal.appendChild(cell);
    }
  }

  // --- Progress Section ---
qs("#add-progress")?.addEventListener("click", () =>
  switchView("progress", qs('[data-view="progress"]'))
);

// Render Progress Data
function renderProgress() {
  const completed = 15;
  const total = 20;
  const avgStudy = 2.3;
  const percent = Math.round((completed / total) * 100);

  qs("#progress-percent").textContent = `${percent}%`;
  qs(".progress-summary").innerHTML = `
    <p><strong>Weekly Tasks Done</strong></p>
    <p>On Track 90%</p>
    <p>Completed ${completed}/${total} tasks</p>
    <p>Avg Study ${avgStudy} hrs daily</p>
  `;
}
renderProgress();

     

  // Profile (main section)
  qs("#user-id-profile").textContent = `User ID: ${me.userId}`;
  const prof = await api.get("/api/profile");
  qs("#profile-name").value = prof.fullName || me.name;
  qs("#profile-email").value = prof.email || me.email;
  qs("#profile-student").value = prof.studentId || me.studentId || "S1121";
  qs("#profile-program").value = prof.program || "Unassigned Program";

  qs("-changes")?.addEventListener("click", async () => {
    const fullName = qs("#profile-name").value.trim();
    const email = qs("#profile-email").value.trim();
    const studentId = qs("#profile-student").value.trim();
    const program = qs("#profile-program").value.trim();
    const updated = await api.put("/api/profile", { fullName, email, studentId, program });
    alert("Profile updated.");
    qs("#user-chip").textContent = updated.fullName;
    qs("#profile-mini-name").textContent = updated.fullName;
  });

  qs("#cancel-changes")?.addEventListener("click", async () => {
    const prof = await api.get("/api/profile");
    qs("#profile-name").value = prof.fullName || me.name;
    qs("#profile-email").value = prof.email || me.email;
    qs("#profile-student").value = prof.studentId || me.studentId || "S1121";
    qs("#profile-program").value = prof.program || "Unassigned Program";
  });

  qs("#change-password")?.addEventListener("click", async () => {
    const oldPassword = prompt("Enter old password");
    if (!oldPassword) return;
    const newPassword = prompt("Enter new password");
    if (!newPassword) return;
    const res = await api
      .post("/api/profile/change-password", { oldPassword, newPassword })
      .catch((err) => ({ error: err.message }));
    if (res.error) return alert(res.error);
    alert("Password changed successfully.");
  });
}



// View switching

function switchView(viewName, btn) {
  qsa(".view").forEach((v) => v.classList.add("hidden"));
  qs(`#view-${viewName}`)?.classList.remove("hidden"); 
  qsa(".nav-btn").forEach((b) => b.classList.remove("active"));
  btn?.classList.add("active");
}



 
















