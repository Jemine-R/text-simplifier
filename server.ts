import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./server/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize tables
async function initializeDatabase() {
  if (db.isPostgres) {
    console.log("Initializing/Verifying Supabase PostgreSQL tables...");
    await db.execRaw(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        "userId" TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "vocabularyTolerance" INTEGER,
        "sentenceLengthPreference" TEXT,
        "complexityCeiling" TEXT,
        "technicalJargonLevel" TEXT,
        "tonePreference" TEXT,
        "abstractContentHandling" TEXT,
        "metaphorUsage" TEXT,
        "preferredStructure" TEXT,
        "readingLevel" TEXT,
        "outputStyle" TEXT,
        "explanationDepth" TEXT DEFAULT 'standard',
        "visualLayout" TEXT DEFAULT 'side-by-side',
        "loraEnabled" INTEGER DEFAULT 1,
        "loraRank" INTEGER DEFAULT 8,
        "loraTrained" INTEGER DEFAULT 0,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transformations (
        id SERIAL PRIMARY KEY,
        "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
        "originalText" TEXT,
        "simplifiedText" TEXT,
        level INTEGER,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS feedback_logs (
        id SERIAL PRIMARY KEY,
        "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
        "originalText" TEXT,
        "simplifiedText" TEXT,
        "clarityScore" INTEGER,
        "lengthScore" INTEGER,
        "toneScore" INTEGER,
        comments TEXT,
        category TEXT,
        "profileUsed" TEXT,
        "readingTime" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id SERIAL PRIMARY KEY,
        "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
        "originalText" TEXT,
        "simplifiedText" TEXT,
        q1_answer TEXT,
        q2_answer TEXT,
        q3_answer TEXT,
        "compositeScore" REAL,
        "readingTime" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } else {
    // Local SQLite Database Initialization
    console.log("Initializing/Verifying local SQLite tables...");
    await db.execRaw(`
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

    // Run SQLite migrations if necessary
    try {
      await db.queryOne("SELECT userId FROM feedback_logs LIMIT 1");
    } catch (e) {
      await db.execRaw("ALTER TABLE feedback_logs ADD COLUMN userId TEXT");
    }

    try {
      await db.queryOne("SELECT loraEnabled FROM user_profiles LIMIT 1");
    } catch (e) {
      await db.execRaw("ALTER TABLE user_profiles ADD COLUMN loraEnabled INTEGER DEFAULT 1");
    }

    try {
      await db.queryOne("SELECT loraRank FROM user_profiles LIMIT 1");
    } catch (e) {
      await db.execRaw("ALTER TABLE user_profiles ADD COLUMN loraRank INTEGER DEFAULT 8");
    }

    try {
      await db.queryOne("SELECT explanationDepth FROM user_profiles LIMIT 1");
    } catch (e) {
      await db.execRaw("ALTER TABLE user_profiles ADD COLUMN explanationDepth TEXT DEFAULT 'standard'");
    }

    try {
      await db.queryOne("SELECT visualLayout FROM user_profiles LIMIT 1");
    } catch (e) {
      await db.execRaw("ALTER TABLE user_profiles ADD COLUMN visualLayout TEXT DEFAULT 'side-by-side'");
    }

    try {
      await db.queryOne("SELECT loraTrained FROM user_profiles LIMIT 1");
    } catch (e) {
      await db.execRaw("ALTER TABLE user_profiles ADD COLUMN loraTrained INTEGER DEFAULT 0");
    }

    try {
      await db.queryOne("SELECT readingTime FROM interactions LIMIT 1");
    } catch (e) {
      await db.execRaw("ALTER TABLE interactions ADD COLUMN readingTime INTEGER DEFAULT 0");
    }

    try {
      await db.queryOne("SELECT readingTime FROM feedback_logs LIMIT 1");
    } catch (e) {
      await db.execRaw("ALTER TABLE feedback_logs ADD COLUMN readingTime INTEGER DEFAULT 0");
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB
  await initializeDatabase();

  app.use(express.json());

  // API Routes
  app.get("/api/users/:username", async (req, res) => {
    try {
      const user = await db.queryOne("SELECT * FROM users WHERE username = ?", [req.params.username]);
      res.json(user || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    const { username } = req.body;
    const id = Math.random().toString(36).substring(2, 11);
    try {
      await db.execute("INSERT INTO users (id, username) VALUES (?, ?)", [id, username]);
      res.json({ id, username });
    } catch (e: any) {
      if (
        e.message.includes('UNIQUE constraint failed') || 
        e.code === '23505' || 
        e.message.includes('unique constraint')
      ) {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: e.message });
      }
    }
  });

  app.get("/api/profile", (req, res) => {
    res.status(404).json({ error: "UserId required" });
  });

  app.get("/api/profile/:userId", async (req, res) => {
    try {
      const profile = await db.queryOne("SELECT * FROM user_profiles WHERE userId = ?", [req.params.userId]);
      res.json(profile || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/profile", async (req, res) => {
    const p = req.body;
    try {
      const loraEnabled = p.loraEnabled !== undefined ? p.loraEnabled : 1;
      const loraRank = p.loraRank !== undefined ? p.loraRank : 8;
      const loraTrained = p.loraTrained !== undefined ? p.loraTrained : 0;
      const explanationDepth = p.explanationDepth || 'standard';
      const visualLayout = p.visualLayout || 'side-by-side';

      await db.execute(`
        INSERT INTO user_profiles (
          "userId", "vocabularyTolerance", "sentenceLengthPreference", "complexityCeiling",
          "technicalJargonLevel", "tonePreference", "abstractContentHandling",
          "metaphorUsage", "preferredStructure", "readingLevel", "outputStyle",
          "explanationDepth", "visualLayout", "loraEnabled", "loraRank", "loraTrained", "updatedAt"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT("userId") DO UPDATE SET
          "vocabularyTolerance"=EXCLUDED."vocabularyTolerance",
          "sentenceLengthPreference"=EXCLUDED."sentenceLengthPreference",
          "complexityCeiling"=EXCLUDED."complexityCeiling",
          "technicalJargonLevel"=EXCLUDED."technicalJargonLevel",
          "tonePreference"=EXCLUDED."tonePreference",
          "abstractContentHandling"=EXCLUDED."abstractContentHandling",
          "metaphorUsage"=EXCLUDED."metaphorUsage",
          "preferredStructure"=EXCLUDED."preferredStructure",
          "readingLevel"=EXCLUDED."readingLevel",
          "outputStyle"=EXCLUDED."outputStyle",
          "explanationDepth"=EXCLUDED."explanationDepth",
          "visualLayout"=EXCLUDED."visualLayout",
          "loraEnabled"=EXCLUDED."loraEnabled",
          "loraRank"=EXCLUDED."loraRank",
          "loraTrained"=EXCLUDED."loraTrained",
          "updatedAt"=CURRENT_TIMESTAMP
      `, [
        p.userId, p.vocabularyTolerance, p.sentenceLengthPreference, p.complexityCeiling,
        p.technicalJargonLevel, p.tonePreference, p.abstractContentHandling,
        p.metaphorUsage, p.preferredStructure, p.readingLevel, p.outputStyle,
        explanationDepth, visualLayout, loraEnabled, loraRank, loraTrained
      ]);
      
      res.json({ status: "success" });
    } catch (e: any) {
      console.error("Profile save error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/transformations", async (req, res) => {
    const { userId, originalText, simplifiedText, level } = req.body;
    try {
      await db.execute(`
        INSERT INTO transformations ("userId", "originalText", "simplifiedText", level)
        VALUES (?, ?, ?, ?)
      `, [userId, originalText, simplifiedText, level]);
      res.json({ status: "success" });
    } catch (e: any) {
      console.error("Transformation save error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/transformations/:userId", async (req, res) => {
    try {
      const history = await db.query(
        'SELECT * FROM transformations WHERE "userId" = ? ORDER BY "createdAt" DESC',
        [req.params.userId]
      );
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/feedback-analysis", async (req, res) => {
    try {
      const categories = await db.query(`
        SELECT category as name, COUNT(*) as count 
        FROM feedback_logs 
        WHERE category IS NOT NULL 
        GROUP BY category
      `);
      
      const stats = await db.queryOne(`
        SELECT AVG("clarityScore") as "averageClarity", COUNT(*) as "totalEntries" 
        FROM feedback_logs
      `);
      
      res.json({
        categories,
        averageClarity: stats && stats.averageClarity ? Number(stats.averageClarity) : 0,
        totalEntries: stats && stats.totalEntries ? Number(stats.totalEntries) : 0
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/feedback", async (req, res) => {
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
      await db.execute(`
        INSERT INTO interactions (
          "userId", "originalText", "simplifiedText", q1_answer, q2_answer, q3_answer, "compositeScore", "readingTime"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId || null, 
        originalText || "", 
        simplifiedText || "", 
        q1_answer || "fully-retained", 
        q2_answer || "extremely-clear", 
        q3_answer || "perfect-tone", 
        compositeScore,
        finalReadingTime
      ]);

      const clarityScore = Math.round(q2_val * 5);
      const toneScore = Math.round(q3_val * 5);
      const lengthScore = Math.round(q1_val * 5);

      // Maintain backward-compatible feedback logging
      await db.execute(`
        INSERT INTO feedback_logs (
          "userId", "originalText", "simplifiedText", "clarityScore", "lengthScore", "toneScore", comments, category, "profileUsed", "readingTime"
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
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
      ]);

      // Check LoRA Trigger threshold (After 5 interactions with composite score >= 0.6)
      let triggeredFineTuning = false;
      let highQualityCount = 0;
      if (userId) {
        const row = await db.queryOne(`
          SELECT COUNT(*) as count FROM interactions 
          WHERE "userId" = ? AND "compositeScore" >= 0.6
        `, [userId]);
        highQualityCount = row ? Number(row.count) : 0;

        if (highQualityCount >= 5) {
          await db.execute(`
            UPDATE user_profiles SET "loraTrained" = 1 WHERE "userId" = ?
          `, [userId]);
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
