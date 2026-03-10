import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("settings.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Default settings
const defaultSettings = {
  backgroundColor: "#0a0a0a",
  backgroundImage: "",
  fajrOffset: "0",
  dhuhrOffset: "0",
  asrOffset: "0",
  maghribOffset: "0",
  ishaOffset: "0",
  location: JSON.stringify({ lat: 34.0837, lng: 74.7973 }), // Default to Srinagar
  method: "Karachi",
  boardName: "Srinagar Salah Board",
  theme: "dark",
  notificationSound: "appp",
  notificationVolume: "0.5",
  azanOffset: "15",
  fajrAzanOffset: "15",
  dhuhrAzanOffset: "15",
  asrAzanOffset: "15",
  maghribAzanOffset: "15",
  ishaAzanOffset: "15",
  azanSound: "chime",
  azanVolume: "0.5"
};

Object.entries(defaultSettings).forEach(([key, value]) => {
  const current = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!current) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value);
  } else if (key === 'location' && current.value === JSON.stringify({ lat: 21.4225, lng: 39.8262 })) {
    // Force update from Makkah to Srinagar if it was the default
    db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(value, key);
  } else if (key === 'method' && current.value === 'MWL') {
    // Force update method if it was the default
    db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(value, key);
  } else if (key === 'boardName' && current.value === 'Nur Salah Board') {
    // Force update board name if it was the default
    db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(value, key);
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/settings", (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all() as { key: string; value: string }[];
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
    res.json(settings);
  });

  app.post("/api/settings", (req, res) => {
    const updates = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    
    db.transaction(() => {
      Object.entries(updates).forEach(([key, value]) => {
        stmt.run(key, String(value));
      });
    })();
    
    res.json({ status: "success" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
