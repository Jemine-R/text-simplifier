import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("simplifier.db");
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT UNIQUE,
    vocabularyTolerance INTEGER,
    sentenceLengthPreference TEXT,
    complexityCeiling TEXT,
    technicalJargonLevel TEXT,
    tonePreference TEXT,
    abstractContentHandling TEXT,
    metaphorUsage TEXT,
    preferredStructure TEXT,
    readingLevel TEXT,
    outputStyle TEXT,
    explanationDepth TEXT DEFAULT 'standard',
    visualLayout TEXT DEFAULT 'side-by-side',
    loraEnabled INTEGER DEFAULT 1,
    loraRank INTEGER DEFAULT 8,
    loraTrained INTEGER DEFAULT 0,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transformations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    originalText TEXT,
    simplifiedText TEXT,
    level INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS feedback_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    originalText TEXT,
    simplifiedText TEXT,
    clarityScore INTEGER,
    lengthScore INTEGER,
    toneScore INTEGER,
    comments TEXT,
    category TEXT,
    profileUsed TEXT,
    readingTime INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    originalText TEXT,
    simplifiedText TEXT,
    q1_answer TEXT,
    q2_answer TEXT,
    q3_answer TEXT,
    compositeScore REAL,
    readingTime INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migration: Add userId column to feedback_logs if it doesn't exist
try {
  db.prepare("SELECT userId FROM feedback_logs LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE feedback_logs ADD COLUMN userId TEXT");
}

// Migration: Add user_profiles columns if they don't exist
try {
  db.prepare("SELECT loraEnabled FROM user_profiles LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE user_profiles ADD COLUMN loraEnabled INTEGER DEFAULT 1");
}
try {
  db.prepare("SELECT loraRank FROM user_profiles LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE user_profiles ADD COLUMN loraRank INTEGER DEFAULT 8");
}
try {
  db.prepare("SELECT explanationDepth FROM user_profiles LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE user_profiles ADD COLUMN explanationDepth TEXT DEFAULT 'standard'");
}
try {
  db.prepare("SELECT visualLayout FROM user_profiles LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE user_profiles ADD COLUMN visualLayout TEXT DEFAULT 'side-by-side'");
}
try {
  db.prepare("SELECT loraTrained FROM user_profiles LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE user_profiles ADD COLUMN loraTrained INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT readingTime FROM interactions LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE interactions ADD COLUMN readingTime INTEGER DEFAULT 0");
}
try {
  db.prepare("SELECT readingTime FROM feedback_logs LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE feedback_logs ADD COLUMN readingTime INTEGER DEFAULT 0");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/users/:username", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.params.username);
    res.json(user || null);
  });

  app.post("/api/users", (req, res) => {
    const { username } = req.body;
    const id = Math.random().toString(36).substring(2, 11);
    try {
      db.prepare("INSERT INTO users (id, username) VALUES (?, ?)").run(id, username);
      res.json({ id, username });
    } catch (e: any) {
      if (e.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.get("/api/profile", (req, res) => {
    res.status(404).json({ error: "UserId required" });
  });

  app.get("/api/profile/:userId", (req, res) => {
    const profile = db.prepare("SELECT * FROM user_profiles WHERE userId = ?").get(req.params.userId);
    res.json(profile || null);
  });

  app.post("/api/profile", (req, res) => {
    const p = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO user_profiles (
          userId, vocabularyTolerance, sentenceLengthPreference, complexityCeiling,
          technicalJargonLevel, tonePreference, abstractContentHandling,
          metaphorUsage, preferredStructure, readingLevel, outputStyle,
          explanationDepth, visualLayout, loraEnabled, loraRank, loraTrained, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(userId) DO UPDATE SET
          vocabularyTolerance=excluded.vocabularyTolerance,
          sentenceLengthPreference=excluded.sentenceLengthPreference,
          complexityCeiling=excluded.complexityCeiling,
          technicalJargonLevel=excluded.technicalJargonLevel,
          tonePreference=excluded.tonePreference,
          abstractContentHandling=excluded.abstractContentHandling,
          metaphorUsage=excluded.metaphorUsage,
          preferredStructure=excluded.preferredStructure,
          readingLevel=excluded.readingLevel,
          outputStyle=excluded.outputStyle,
          explanationDepth=excluded.explanationDepth,
          visualLayout=excluded.visualLayout,
          loraEnabled=excluded.loraEnabled,
          loraRank=excluded.loraRank,
          loraTrained=excluded.loraTrained,
          updatedAt=CURRENT_TIMESTAMP
      `);
      
      const loraEnabled = p.loraEnabled !== undefined ? p.loraEnabled : 1;
      const loraRank = p.loraRank !== undefined ? p.loraRank : 8;
      const loraTrained = p.loraTrained !== undefined ? p.loraTrained : 0;
      const explanationDepth = p.explanationDepth || 'standard';
      const visualLayout = p.visualLayout || 'side-by-side';

      stmt.run(
        p.userId, p.vocabularyTolerance, p.sentenceLengthPreference, p.complexityCeiling,
        p.technicalJargonLevel, p.tonePreference, p.abstractContentHandling,
        p.metaphorUsage, p.preferredStructure, p.readingLevel, p.outputStyle,
        explanationDepth, visualLayout, loraEnabled, loraRank, loraTrained
      );
      
      res.json({ status: "success" });
    } catch (e: any) {
      console.error("Profile save error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/transformations", (req, res) => {
    const { userId, originalText, simplifiedText, level } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO transformations (userId, originalText, simplifiedText, level)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(userId, originalText, simplifiedText, level);
      res.json({ status: "success" });
    } catch (e: any) {
      console.error("Transformation save error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/transformations/:userId", (req, res) => {
    const history = db.prepare("SELECT * FROM transformations WHERE userId = ? ORDER BY createdAt DESC").all(req.params.userId);
    res.json(history);
  });

  app.get("/api/feedback-analysis", (req, res) => {
    const categories = db.prepare(`
      SELECT category as name, COUNT(*) as count 
      FROM feedback_logs 
      WHERE category IS NOT NULL 
      GROUP BY category
    `).all();
    
    const stats = db.prepare(`
      SELECT AVG(clarityScore) as averageClarity, COUNT(*) as totalEntries 
      FROM feedback_logs
    `).get() as { averageClarity: number | null, totalEntries: number };
    
    res.json({
      categories,
      averageClarity: stats.averageClarity || 0,
      totalEntries: stats.totalEntries || 0
    });
  });

  app.post("/api/feedback", (req, res) => {
    const { userId, originalText, simplifiedText, q1_answer, q2_answer, q3_answer, comments, readingTime } = req.body;
    try {
      // Determine sub-scores
      let q1_val = 1.0;
      if (q1_answer === "partially-retained") q1_val = 0.5;
      else if (q1_answer === "meaning-lost") q1_val = 0.0;

      let q2_val = 1.0;
      if (q2_answer === "moderately-clear") q2_val = 0.6;
      else if (q2_answer === "hard-to-understand") q2_val = 0.2;

      let q3_val = 1.0;
      if (q3_answer === "acceptable") q3_val = 0.6;
      else if (q3_answer === "inappropriate") q3_val = 0.2;

      const compositeScore = Math.round(((q1_val + q2_val + q3_val) / 3) * 100) / 100;
      const finalReadingTime = readingTime !== undefined ? Number(readingTime) : 0;

      // Insert into interactions table
      const insertInteraction = db.prepare(`
        INSERT INTO interactions (
          userId, originalText, simplifiedText, q1_answer, q2_answer, q3_answer, compositeScore, readingTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertInteraction.run(
        userId || null, 
        originalText || "", 
        simplifiedText || "", 
        q1_answer || "fully-retained", 
        q2_answer || "extremely-clear", 
        q3_answer || "perfect-tone", 
        compositeScore,
        finalReadingTime
      );

      // Maintain backward-compatible feedback logging
      const stmt = db.prepare(`
        INSERT INTO feedback_logs (
          userId, originalText, simplifiedText, clarityScore, lengthScore, toneScore, comments, category, profileUsed, readingTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const clarityScore = Math.round(q2_val * 5);
      const toneScore = Math.round(q3_val * 5);
      const lengthScore = Math.round(q1_val * 5);

      stmt.run(
        userId || null,
        originalText || "", 
        simplifiedText || "", 
        clarityScore, 
        lengthScore, 
        toneScore, 
        comments || "", 
        'general',
        JSON.stringify({ q1_answer, q2_answer, q3_answer, compositeScore }),
        finalReadingTime
      );

      // Check LoRA Trigger threshold (After 5 interactions with composite score >= 0.6)
      let triggeredFineTuning = false;
      let highQualityCount = 0;
      if (userId) {
        const row = db.prepare(`
          SELECT COUNT(*) as count FROM interactions 
          WHERE userId = ? AND compositeScore >= 0.6
        `).get(userId) as { count: number };
        highQualityCount = row.count;

        if (highQualityCount >= 5) {
          // Save adapter per user inside user_profiles table (loraTrained starts as 1)
          db.prepare(`
            UPDATE user_profiles SET loraTrained = 1 WHERE userId = ?
          `).run(userId);
          triggeredFineTuning = true;
        }
      }

      res.json({ 
        status: "success", 
        compositeScore, 
        highQualityCount,
        triggeredFineTuning 
      });
    } catch (e: any) {
      console.error("Feedback save error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
