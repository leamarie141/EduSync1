const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const cors = require("cors");
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI, {
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("Mongo DB connection error:", err));

// --- Schemas ---
const UserSchema = new mongoose.Schema({
  name: String,
  username: String,
  email: String,
  passwordHash: String,
  studentId: String,
  program: String,
  createdAt: String,
  verified: Boolean,
  profile: {
    fullName: String,
    email: String,
    studentId: String,
    program: String,
  }
});

const NoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  content: String,
  category: String,
  createdAt: String,
  updatedAt: String,
});

const AssignmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  description: String,
  filename: String,
  status: String,
  submittedAt: String,
  lastSubmission: String,
});

const EventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: String,
  date: String, // ISO YYYY-MM-DD
});

const ProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  completed: Number,
  total: Number,
  avgStudyHours: Number,
  createdAt: String,
});

const User = mongoose.model("User", UserSchema);
const Note = mongoose.model("Note", NoteSchema);
const Assignment = mongoose.model("Assignment", AssignmentSchema);
const Event = mongoose.model("Event", EventSchema);
const Progress = mongoose.model("Progress", ProgressSchema);

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
      secure: true,
      sameSite: "none"
    },
  })
);

app.use(cors({
  origin: "https://edusync-s4z1.onrender.com",
  credentials: true
}));

function hash(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
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

// Register/Login/Logout/User/Profile routes (already shown above)...

// Notes
app.get("/api/notes", requireAuth, async (req, res) => {
  const notes = await Note.find({ userId: req.session.userId });
  res.json(notes);
});

app.post("/api/notes", requireAuth, async (req, res) => {
  const { title, content, category } = req.body;
  const note = new Note({
    userId: req.session.userId,
    title: title || "My Note",
    content: content || "",
    category: category || "General",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await note.save();
  res.json(note);
});

app.put("/api/notes/:id", requireAuth, async (req, res) => {
  const { title, content, category } = req.body;
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.session.userId },
    { title, content, category, updatedAt: new Date().toISOString() },
    { new: true }
  );
  if (!note) return res.status(404).json({ error: "Not found" });
  res.json(note);
});

app.delete("/api/notes/:id", requireAuth, async (req, res) => {
  const result = await Note.deleteOne({ _id: req.params.id, userId: req.session.userId });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// Assignments
app.get("/api/assignments", requireAuth, async (req, res) => {
  const assignments = await Assignment.find({ userId: req.session.userId });
  res.json(assignments);
});

app.post("/api/assignments", requireAuth, async (req, res) => {
  const { title, description, filename } = req.body;
  const assignment = new Assignment({
    userId: req.session.userId,
    title: title || "Untitled",
    description: description || "",
    filename: filename || "",
    status: "Submitted",
    submittedAt: new Date().toISOString(),
    lastSubmission: new Date().toLocaleString(),
  });
  await assignment.save();
  res.json(assignment);
});

app.put("/api/assignments/:id/resubmit", requireAuth, async (req, res) => {
  const { description, filename } = req.body;
  const assignment = await Assignment.findOneAndUpdate(
    { _id: req.params.id, userId: req.session.userId },
    { description, filename, status: "Resubmitted", lastSubmission: new Date().toLocaleString() },
    { new: true }
  );
  if (!assignment) return res.status(404).json({ error: "Not found" });
  res.json(assignment);
});

// Events
app.get("/api/events", requireAuth, async (req, res) => {
  const events = await Event.find({ userId: req.session.userId });
  res.json(events);
});

app.post("/api/events", requireAuth, async (req, res) => {
  const { title, date } = req.body;
  const event = new Event({ userId: req.session.userId, title, date });
  await event.save();
  res.json(event);
});

app.delete("/api/events/:id", requireAuth, async (req, res) => {
  const result = await Event.deleteOne({ _id: req.params.id, userId: req.session.userId });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Not found" });
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

// Progress (instead of Groups)
app.get("/api/progress", requireAuth, async (req, res) => {
  const progress = await Progress.find({ userId: req.session.userId });
  res.json(progress);
});

app.post("/api/progress", requireAuth, async (req, res) => {
  const { completed, total, avgStudyHours } = req.body;
  const record = new Progress({
    userId: req.session.userId,
    completed,
    total,
    avgStudyHours,
    createdAt: new Date().toISOString(),
  });
  await record.save();
  res.json(record);
});

app.delete("/api/progress/:id", requireAuth, async (req, res) => {
  const result = await Progress.deleteOne({ _id: req.params.id, userId: req.session.userId });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

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
