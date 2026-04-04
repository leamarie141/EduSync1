const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const cors = require("cors");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Session setup ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      httpOnly: true,
      secure: false,
      sameSite: "lax"
     },
  })
);

app.use(cors({
  origin: "https://edusync-s4z1.onrender.com",
  credentials: true
}));

// In-memory storage
const users = {}; // userId -> { id, name, username, email, passwordHash, studentId, program, createdAt }
const data = {};  // userId -> { notes:[], assignments:[], events:[], groups:[], profile:{} }

function hash(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function makeUserId() {
  // 17-digit-like ID
  return String(Math.floor(Math.random() * 9e16 + 1e16));
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS 
  }
});



// --- Auth gate ---
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }
  next();
}

// --- API routes ---
// Auth
app.post("/api/auth/register", async (req, res) => {
  const { name, username, email, password, studentId } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const existing = Object.values(users).find(
    (u) => u.email === email || u.username === username
  );
  if (existing) return res.status(409).json({ error: "User already exists" });

  const id = makeUserId();

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  users[id] = {
    id,
    name,
    username,
    email,
    studentId: studentId || "S1121",
    passwordHash: hash(password),
    program: "Unassigned Program",
    createdAt: new Date().toISOString(),
    verified: false,
    verificationCode
  };

  data[id] = {
    notes: [],
    assignments: [],
    events: [],
    groups: [],
    profile: {
      fullName: name,
      email,
      studentId: users[id].studentId,
      program: "Unassigned Program",
    },
  };

  try {
    await transporter.sendMail({
      from: "your-email@gmail.com",
      to: email,
      subject: "EduSync Email Verification",
      text: `Your verification code is: ${verificationCode}`
    });
  } catch (err) {
    console.error("Error sending email:", err);
    return res.status(500).json({ error: "Failed to send verification email"});
  }

  res.json({ success: true, message: "Registered. Please verify your email." });
});

app.post("/api/auth/verify", (req, res) => {
  const { email, code } = req.body;
  const user = Object.values(users).find((u) => u.email === email);

  if (!user) return res.status(400).json({ error: "User not found" });
  if (user.verificationCode !== code) return res.status(400).json({ error: "Invalid code" });

  user.verified = true;
  delete user.verificationCode;

  res.json({ success: true, message: "Email verified successfully!" });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = Object.values(users).find((u) => u.email === email);
  if (!user || user.passwordHash !== hash(password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.verified) {
    return res.status(403).json({ error: "Please verify your email before logging in."});
  }
  req.session.userId = user.id;
  res.json({ userId: user.id, name: user.name, email: user.email });
});



app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/user/me", requireAuth, (req, res) => {
  const u = users[req.session.userId];
  res.json({
    userId: u.id,
    name: u.name,
    email: u.email,
    studentId: u.studentId,
    program: u.program,
  });
});

// Profile
app.get("/api/profile", requireAuth, (req, res) => {
  console.log("Profile route hit, userId:", req.session.userId);
  const id = req.session.userId;
  if (!data[id] || !data[id].profile) {
    return res.status(404).json({ error: "No profile for user" });
  }
  res.json(data[id].profile);
});

app.put("/api/profile", requireAuth, (req, res) => {
  const { fullName, email, studentId, program } = req.body;
  const id = req.session.userId;

  if (fullName) users[id].name = fullName;
  if (email) users[id].email = email;
  if (studentId) users[id].studentId = studentId;
  if (program) users[id].program = program;

  data[id].profile = {
    fullName: users[id].name,
    email: users[id].email,
    studentId: users[id].studentId,
    program: users[id].program,
  };

  res.json(data[id].profile);
});

app.post("/api/profile/change-password", requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const id = req.session.userId;
  if (users[id].passwordHash !== hash(oldPassword)) {
    return res.status(400).json({ error: "Old password incorrect" });
  }
  users[id].passwordHash = hash(newPassword);
  res.json({ ok: true });
});

//Update profiles
app.put("/api/profile", (req, res) => {
  const { name, email, studentId, program } = req.body;
  // TODO: save to DB
  res.json({ success: true, name, email, studentId, program });
});

// Update password
app.put("/api/profile/password", (req, res) => {
  const { password } = req.body;
  // TODO: hash + save password
  res.json({ success: true });
});

// Notes
app.get("/api/notes", requireAuth, (req, res) => {
  res.json(data[req.session.userId].notes);
});

app.post("/api/notes", requireAuth, (req, res) => {
  const { title, content, category } = req.body;
  const note = {
    id: crypto.randomUUID(),
    title: title || "My Note",
    content: content || "",
    category: category || "General",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data[req.session.userId].notes.unshift(note);
  res.json(note);
});

app.put("/api/notes/:id", requireAuth, (req, res) => {
  const list = data[req.session.userId].notes;
  const i = list.findIndex((n) => n.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });

  const { title, content, category } = req.body;
  list[i] = {
    ...list[i],
    title: title ?? list[i].title,
    content: content ?? list[i].content,
    category: category ?? list[i].category,
    updatedAt: new Date().toISOString(),
  };
  res.json(list[i]);
});

app.delete("/api/notes/:id", requireAuth, (req, res) => {
  const list = data[req.session.userId].notes;
  const i = list.findIndex((n) => n.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  list.splice(i, 1);
  res.json({ ok: true });
});

// Share links (dummy)
app.post("/api/share", requireAuth, (req, res) => {
  const { type, noteId } = req.body; // type: text | image | word
  res.json({
    url: "https://example.com",
    type,
    noteId,
    options: ["Bluetooth", "LinkedIn", "Messenger", "Instagram", "Facebook", "Gmail"],
  });
});

// Assignments
app.get("/api/assignments", requireAuth, (req, res) => {
  res.json(data[req.session.userId].assignments);
});

app.post("/api/assignments", requireAuth, (req, res) => {
  const { title, description, filename } = req.body; // filename simulated
  const assignment = {
    id: crypto.randomUUID(),
    title: title || "Untitled",
    description: description || "",
    filename: filename || "",
    status: "Submitted",
    submittedAt: new Date().toISOString(),
    lastSubmission: new Date().toLocaleString(),
  };
  data[req.session.userId].assignments.unshift(assignment);
  res.json(assignment);
});

app.put("/api/assignments/:id/resubmit", requireAuth, (req, res) => {
  const list = data[req.session.userId].assignments;
  const i = list.findIndex((a) => a.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });

  const { description, filename } = req.body;
  list[i] = {
    ...list[i],
    description: description ?? list[i].description,
    filename: filename ?? list[i].filename,
    status: "Resubmitted",
    lastSubmission: new Date().toLocaleString(),
  };
  res.json(list[i]);
});

// Events
app.get("/api/events", requireAuth, (req, res) => {
  res.json(data[req.session.userId].events);
});

app.post("/api/events", requireAuth, (req, res) => {
  const { title, date } = req.body; // ISO date YYYY-MM-DD
  const event = { id: crypto.randomUUID(), title, date };
  data[req.session.userId].events.push(event);
  res.json(event);
});

app.delete("/api/events/:id", requireAuth, (req, res) => {
  const list = data[req.session.userId].events;
  const i = list.findIndex((e) => e.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  list.splice(i, 1);
  res.json({ ok: true });
});

// Groups
app.get("/api/groups", requireAuth, (req, res) => {
  res.json(data[req.session.userId].groups);
});

app.post("/api/groups", requireAuth, (req, res) => {
  const { title, content } = req.body;
  const note = {
    id: crypto.randomUUID(),
    title: title || "Group Project",
    content:
      content ||
      "This project is collaborative outputs of the group. Each member contributed ideas, research, and effort to complete the content. We would like to acknowledge our teacher for guiding us throughout the process.",
    createdAt: new Date().toISOString(),
  };
  data[req.session.userId].groups.unshift(note);
  res.json(note);
});

app.delete("/api/groups/:id", requireAuth, (req, res) => {
  const list = data[req.session.userId].groups;
  const i = list.findIndex((g) => g.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  list.splice(i, 1);
  res.json({ ok: true });
});

app.get("/api/notes", requireAuth, (req, res)=>{
  console.log("Notes route hit, userId:", req.session.userId);
  res.json(data[req.session.userId]?.notes || []);
})


// --- Static files and dashboard routes ---
app.use(express.static(path.join(__dirname, "../public")));

app.get("/app", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "dashboard.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
  console.log(`EduSync server running on ${PORT}`);
});