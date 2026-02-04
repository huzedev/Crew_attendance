import express from "express";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const db = await open({
  filename: path.join(__dirname, "crew_attendance.db"),
  driver: sqlite3.Database,
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    dream_class TEXT NOT NULL,
    status TEXT NOT NULL,
    last_updated TEXT
  );
`);

await db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );
`);

async function getStudentWithRecords(studentId) {
  const student = await db.get(
    "SELECT id, name, dream_class as dreamClass, status, last_updated as lastUpdated FROM students WHERE id = ?",
    studentId
  );
  if (!student) {
    return null;
  }
  const records = await db.all(
    "SELECT status, note, timestamp FROM records WHERE student_id = ? ORDER BY id DESC",
    studentId
  );
  return { ...student, records };
}

app.get("/api/students", async (req, res) => {
  const students = await db.all(
    "SELECT id, name, dream_class as dreamClass, status, last_updated as lastUpdated FROM students ORDER BY rowid DESC"
  );
  const results = [];
  for (const student of students) {
    const records = await db.all(
      "SELECT status, note, timestamp FROM records WHERE student_id = ? ORDER BY id DESC",
      student.id
    );
    results.push({ ...student, records });
  }
  res.json(results);
});

app.post("/api/students", async (req, res) => {
  const { id, name, dreamClass } = req.body;
  if (!id || !name || !dreamClass) {
    res.status(400).json({ error: "Missing required fields." });
    return;
  }

  const timestamp = new Date().toLocaleString();
  await db.run(
    "INSERT INTO students (id, name, dream_class, status, last_updated) VALUES (?, ?, ?, ?, ?)",
    id,
    name,
    dreamClass,
    "present",
    timestamp
  );
  await db.run(
    "INSERT INTO records (student_id, status, note, timestamp) VALUES (?, ?, ?, ?)",
    id,
    "present",
    "Added to roster",
    timestamp
  );

  const student = await getStudentWithRecords(id);
  res.status(201).json(student);
});

app.patch("/api/students/:id", async (req, res) => {
  const { status, note } = req.body;
  const { id } = req.params;
  if (!status || !note) {
    res.status(400).json({ error: "Missing status or note." });
    return;
  }

  const timestamp = new Date().toLocaleString();
  const result = await db.run(
    "UPDATE students SET status = ?, last_updated = ? WHERE id = ?",
    status,
    timestamp,
    id
  );
  if (result.changes === 0) {
    res.status(404).json({ error: "Student not found." });
    return;
  }

  await db.run(
    "INSERT INTO records (student_id, status, note, timestamp) VALUES (?, ?, ?, ?)",
    id,
    status,
    note,
    timestamp
  );

  const student = await getStudentWithRecords(id);
  res.json(student);
});

app.post("/api/students/bulk", async (req, res) => {
  const { status } = req.body;
  if (!status) {
    res.status(400).json({ error: "Missing status." });
    return;
  }
  const timestamp = new Date().toLocaleString();
  const students = await db.all("SELECT id FROM students");

  for (const student of students) {
    await db.run(
      "UPDATE students SET status = ?, last_updated = ? WHERE id = ?",
      status,
      timestamp,
      student.id
    );
    await db.run(
      "INSERT INTO records (student_id, status, note, timestamp) VALUES (?, ?, ?, ?)",
      student.id,
      status,
      `Bulk update: marked ${status}`,
      timestamp
    );
  }

  const refreshed = await db.all(
    "SELECT id, name, dream_class as dreamClass, status, last_updated as lastUpdated FROM students ORDER BY rowid DESC"
  );
  const results = [];
  for (const student of refreshed) {
    const records = await db.all(
      "SELECT status, note, timestamp FROM records WHERE student_id = ? ORDER BY id DESC",
      student.id
    );
    results.push({ ...student, records });
  }
  res.json(results);
});

app.listen(port, () => {
  console.log(`Crew attendance server running on http://localhost:${port}`);
});
