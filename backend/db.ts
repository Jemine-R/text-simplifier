import Database from "better-sqlite3";
import pg from "pg";

let isPostgres = false;
let sqliteDb: any = null;
let pgPool: pg.Pool | null = null;

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (connectionString) {
  console.log("Supabase/PostgreSQL connection string detected. Connecting...");
  pgPool = new pg.Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
  isPostgres = true;
} else {
  console.log("No PostgreSQL connection string. Falling back to local SQLite...");
  sqliteDb = new Database("simplifier.db");
  sqliteDb.pragma('foreign_keys = ON');
}

function convertSql(sql: string): string {
  if (!isPostgres) return sql;
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

export const db = {
  isPostgres,

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (isPostgres) {
      const converted = convertSql(sql);
      const res = await pgPool!.query(converted, params);
      return res.rows as T[];
    } else {
      return sqliteDb.prepare(sql).all(...params) as T[];
    }
  },

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    if (isPostgres) {
      const converted = convertSql(sql);
      const res = await pgPool!.query(converted, params);
      return (res.rows[0] || null) as T | null;
    } else {
      return sqliteDb.prepare(sql).get(...params) as T | null;
    }
  },

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (isPostgres) {
      const converted = convertSql(sql);
      return await pgPool!.query(converted, params);
    } else {
      return sqliteDb.prepare(sql).run(...params);
    }
  },

  async execRaw(sql: string): Promise<void> {
    if (isPostgres) {
      await pgPool!.query(sql);
    } else {
      sqliteDb.exec(sql);
    }
  }
};
