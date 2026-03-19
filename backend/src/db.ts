import bcrypt from "bcryptjs";
import { Pool, PoolClient } from "pg";

/** Postgres 连接池单例，用于达人分发 APP 用户、角色、积分与审计 */
let pool: Pool | null = null;
let initialized = false;

/**
 * 获取 Postgres 连接池实例（单例）。
 */
export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL 未配置：请在环境变量中提供 Render Postgres 连接串。");
  }

  pool = new Pool({
    connectionString,
    // Render Postgres 通常要求 SSL；本地可不启用。若需要严格校验证书可自行调整。
    ssl: connectionString.includes("render.com") || connectionString.includes("onrender.com") ? ({ rejectUnauthorized: false } as any) : undefined,
  });
  return pool;
}

/**
 * 执行 SQL 查询，统一使用参数化占位符（$1, $2...）。
 */
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const p = getPool();
  const res = await p.query(text, params);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}

/**
 * 在事务中执行回调，回调抛错则自动回滚。
 */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * 初始化表结构与默认数据（roles/config/默认账号）。
 * 需在服务启动时调用一次，确保数据库可用与结构齐全。
 */
export async function initDb(): Promise<void> {
  if (initialized) return;
  initialized = true;

  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    INSERT INTO roles (id, name) VALUES (1, 'admin'), (2, 'client'), (3, 'influencer')
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      display_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS point_accounts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS point_ledger (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES point_accounts(id),
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      ref_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      request_id TEXT,
      user_id INTEGER,
      path TEXT,
      method TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT INTO config (key, value) VALUES ('point_rate_thb', '1')
    ON CONFLICT (key) DO NOTHING;
    INSERT INTO config (key, value) VALUES ('daily_claim_limit', '10')
    ON CONFLICT (key) DO NOTHING;
    INSERT INTO config (key, value) VALUES ('lock_period_days', '5')
    ON CONFLICT (key) DO NOTHING;
    INSERT INTO config (key, value) VALUES ('violation_deduct_full', '1')
    ON CONFLICT (key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('face', 'explain')),
      cloud_link TEXT NOT NULL,
      platforms TEXT,
      remark TEXT,
      status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      material_id INTEGER NOT NULL REFERENCES materials(id),
      type TEXT NOT NULL CHECK (type IN ('face', 'explain')),
      platform TEXT NOT NULL,
      max_claim_count INTEGER,
      point_reward INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS influencer_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      show_face INTEGER NOT NULL DEFAULT 0,
      tags TEXT,
      platforms TEXT,
      blacklisted INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS task_claims (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'locked', 'settled')),
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      task_claim_id INTEGER NOT NULL UNIQUE REFERENCES task_claims(id),
      work_link TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS client_requests (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id),
      product_info TEXT,
      target_platform TEXT,
      budget TEXT,
      need_face INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'processing', 'done')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sample_orders (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id),
      request_id INTEGER REFERENCES client_requests(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received')),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS settlement_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      week_start DATE NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'exception')),
      paid_at TIMESTAMPTZ,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS submission_checks (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL REFERENCES submissions(id),
      check_result TEXT NOT NULL CHECK (check_result IN ('ok', 'deleted', 'suspicious')),
      checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS influencer_violations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      submission_id INTEGER REFERENCES submissions(id),
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      paid_at TIMESTAMPTZ
    );
  `);

  await seedDefaultUsers();
}

/**
 * 将环境变量值解析为布尔值（1/true/yes/on 视为 true），用于种子数据开关。
 */
function envBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

/**
 * 若用户不存在则创建，并确保其积分账户存在（已存在则不覆盖密码）。
 */
async function ensureUserIfMissing(username: string, password: string, roleId: number): Promise<void> {
  const existed = await query<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);
  const userId = existed.rows[0]?.id;
  if (userId) {
    await query("INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING", [userId]);
    return;
  }

  const password_hash = bcrypt.hashSync(password, 10) as string;
  const created = await query<{ id: number }>("INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id", [username, password_hash, roleId]);
  const createdUserId = created.rows[0]!.id;
  await query("INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING", [createdUserId]);
}

/**
 * 创建默认账号（Postgres 版本）：
 * - 始终确保管理员存在：admin / admin123（仅在缺失时创建，不会覆盖已有密码）
 * - 可选创建演示账号（默认开启，可用环境变量关闭），避免每次手动注册 client / influencer
 */
async function seedDefaultUsers(): Promise<void> {
  // 1=admin, 2=client, 3=influencer（见 roles 表初始化）
  await ensureUserIfMissing("admin", "admin123", 1);

  const seedDemo = envBool("SEED_DEMO_USERS", true);
  if (!seedDemo) return;

  const clientUsername = process.env.SEED_CLIENT_USERNAME || "client002";
  const clientPassword = process.env.SEED_CLIENT_PASSWORD || "123456";
  const influencerUsername = process.env.SEED_INFLUENCER_USERNAME || "influencer002";
  const influencerPassword = process.env.SEED_INFLUENCER_PASSWORD || "123456";

  await ensureUserIfMissing(clientUsername, clientPassword, 2);
  await ensureUserIfMissing(influencerUsername, influencerPassword, 3);
}
