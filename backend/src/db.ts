import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";

/** 数据库单例，用于达人分发 APP 用户、角色、积分与审计 */
let db: Database.Database | null = null;

/**
 * 获取 SQLite 数据库实例，首次调用时初始化表结构。
 */
export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "app.db");
  const dir = path.dirname(dbPath);
  try {
    const fs = require("fs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    // 忽略目录创建失败，SQLite 可能仍能写入
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  return db;
}

/**
 * 初始化表结构：角色、用户、积分账户、积分流水、审计日志、系统配置。
 */
function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'admin'), (2, 'client'), (3, 'influencer');

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS point_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS point_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES point_accounts(id),
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      ref_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT,
      user_id INTEGER,
      path TEXT,
      method TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO config (key, value) VALUES ('point_rate_thb', '1');
    INSERT OR IGNORE INTO config (key, value) VALUES ('daily_claim_limit', '10');

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('face', 'explain')),
      cloud_link TEXT NOT NULL,
      platforms TEXT,
      remark TEXT,
      status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL REFERENCES materials(id),
      type TEXT NOT NULL CHECK (type IN ('face', 'explain')),
      platform TEXT NOT NULL,
      max_claim_count INTEGER,
      point_reward INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS influencer_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      show_face INTEGER NOT NULL DEFAULT 0,
      tags TEXT,
      platforms TEXT,
      blacklisted INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'locked', 'settled')),
      claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_claim_id INTEGER NOT NULL REFERENCES task_claims(id) UNIQUE,
      work_link TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS client_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id),
      product_info TEXT,
      target_platform TEXT,
      budget TEXT,
      need_face INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'processing', 'done')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sample_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id),
      request_id INTEGER REFERENCES client_requests(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO config (key, value) VALUES ('lock_period_days', '5');
    INSERT OR IGNORE INTO config (key, value) VALUES ('violation_deduct_full', '1');

    CREATE TABLE IF NOT EXISTS settlement_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_start TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'exception')),
      paid_at TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS submission_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      check_result TEXT NOT NULL CHECK (check_result IN ('ok', 'deleted', 'suspicious')),
      checked_at TEXT NOT NULL DEFAULT (datetime('now')),
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS influencer_violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      submission_id INTEGER REFERENCES submissions(id),
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  seedAdminIfNeeded(database);
}

/** 若不存在任何用户，则创建默认管理员 admin / admin123，请上线后修改密码 */
function seedAdminIfNeeded(database: Database.Database): void {
  const hasAny = database.prepare("SELECT 1 FROM users LIMIT 1").get();
  if (hasAny) return;
  const password_hash = bcrypt.hashSync("admin123", 10) as string;
  const r = database.prepare("INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, 1)").run("admin", password_hash);
  const userId = r.lastInsertRowid as number;
  database.prepare("INSERT INTO point_accounts (user_id, balance) VALUES (?, 0)").run(userId);
}
