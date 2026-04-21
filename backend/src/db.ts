import bcrypt from "bcryptjs";

import { Pool, PoolClient } from "pg";



/** Postgres 连接池实例：用于达人分发 APP 的数据库访问。 */

let pool: Pool | null = null;

let initialized = false;

const FULL_INIT_SQL = `

  CREATE TABLE IF NOT EXISTS roles (

    id INTEGER PRIMARY KEY,

    name TEXT NOT NULL UNIQUE

  );

  INSERT INTO roles (id, name) VALUES (1, 'admin'), (2, 'client'), (3, 'influencer'), (4, 'employee')

  ON CONFLICT (id) DO NOTHING;



  CREATE TABLE IF NOT EXISTS users (

    id SERIAL PRIMARY KEY,

    username TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role_id INTEGER NOT NULL REFERENCES roles(id),

    display_name TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled INTEGER NOT NULL DEFAULT 0;



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

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ,

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

    biz_status TEXT NOT NULL DEFAULT 'open' CHECK (biz_status IN ('open', 'in_progress', 'done')),

    claimed_count INTEGER NOT NULL DEFAULT 0,

    fulfilled_count INTEGER NOT NULL DEFAULT 0,

    tiktok_link TEXT,

    product_images JSONB NOT NULL DEFAULT '[]'::jsonb,

    sku_codes JSONB NOT NULL DEFAULT '[]'::jsonb,

    sku_images JSONB NOT NULL DEFAULT '[]'::jsonb,

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

  );



  CREATE TABLE IF NOT EXISTS influencer_profiles (

    user_id INTEGER PRIMARY KEY REFERENCES users(id),

    show_face INTEGER NOT NULL DEFAULT 0,

    tags TEXT,

    platforms TEXT,

    blacklisted INTEGER NOT NULL DEFAULT 0,

    level INTEGER NOT NULL DEFAULT 1,

    is_premium INTEGER NOT NULL DEFAULT 0,

    can_publish_demand INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

  );



  CREATE TABLE IF NOT EXISTS task_claims (

    id SERIAL PRIMARY KEY,

    task_id INTEGER NOT NULL REFERENCES tasks(id),

    user_id INTEGER NOT NULL REFERENCES users(id),

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected', 'locked', 'settled')),

    claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ,

    UNIQUE(task_id, user_id)

  );



  CREATE TABLE IF NOT EXISTS submissions (

    id SERIAL PRIMARY KEY,

    task_claim_id INTEGER NOT NULL UNIQUE REFERENCES task_claims(id),

    work_link TEXT NOT NULL,

    note TEXT,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    reviewed_at TIMESTAMPTZ,

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

  );



  CREATE TABLE IF NOT EXISTS client_requests (

    id SERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES users(id),

    product_info TEXT,

    target_platform TEXT,

    budget TEXT,

    need_face INTEGER NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'processing', 'done')),

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

  );



  CREATE TABLE IF NOT EXISTS sample_orders (

    id SERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES users(id),

    request_id INTEGER REFERENCES client_requests(id),

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'received')),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

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

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ,

    UNIQUE(user_id, week_start)

  );



  CREATE TABLE IF NOT EXISTS submission_checks (

    id SERIAL PRIMARY KEY,

    submission_id INTEGER NOT NULL REFERENCES submissions(id),

    check_result TEXT NOT NULL CHECK (check_result IN ('ok', 'deleted', 'suspicious')),

    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    note TEXT,

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

  );



  CREATE TABLE IF NOT EXISTS influencer_violations (

    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL REFERENCES users(id),

    submission_id INTEGER REFERENCES submissions(id),

    reason TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

  );



  CREATE TABLE IF NOT EXISTS withdrawal_requests (

    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL REFERENCES users(id),

    amount INTEGER NOT NULL CHECK (amount > 0),

    bank_account_name TEXT,

    bank_name TEXT,

    bank_account_no TEXT,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    paid_at TIMESTAMPTZ,

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

  );

  ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

  ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS bank_name TEXT;

  ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS bank_account_no TEXT;



  CREATE TABLE IF NOT EXISTS recharge_orders (

    id SERIAL PRIMARY KEY,

    order_no TEXT,

    user_id INTEGER NOT NULL REFERENCES users(id),

    amount INTEGER NOT NULL CHECK (amount > 0),

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    approved_at TIMESTAMPTZ,

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

  );

  ALTER TABLE recharge_orders ADD COLUMN IF NOT EXISTS order_no TEXT;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_recharge_orders_order_no ON recharge_orders(order_no) WHERE order_no IS NOT NULL;



  CREATE TABLE IF NOT EXISTS biz_order_counters (

    prefix TEXT NOT NULL,

    date_key TEXT NOT NULL,

    last_no INTEGER NOT NULL,

    PRIMARY KEY (prefix, date_key)

  );



  CREATE TABLE IF NOT EXISTS client_market_orders (

    id SERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES users(id),

    order_no TEXT,

    title TEXT NOT NULL DEFAULT '未命名订单',

    reward_points INTEGER NOT NULL DEFAULT 10 CHECK (reward_points > 0),

    tier TEXT NOT NULL DEFAULT 'C' CHECK (tier IN ('C', 'B', 'A')),

    creator_reward_points INTEGER NOT NULL DEFAULT 5 CHECK (creator_reward_points > 0),

    platform_profit_points INTEGER NOT NULL DEFAULT 0,

    pay_deducted INTEGER NOT NULL DEFAULT 0 CHECK (pay_deducted IN (0, 1)),

    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'completed', 'cancelled')),

    influencer_id INTEGER REFERENCES users(id),

    work_links JSONB NOT NULL DEFAULT '[]'::jsonb,

    voice_link TEXT,

    voice_note TEXT,

    tiktok_link TEXT,

    product_images JSONB NOT NULL DEFAULT '[]'::jsonb,

    sku_codes JSONB NOT NULL DEFAULT '[]'::jsonb,

    sku_images JSONB NOT NULL DEFAULT '[]'::jsonb,

    sku_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

    client_shop_name TEXT,

    client_group_chat TEXT,

    publish_method TEXT NOT NULL DEFAULT 'client_self_publish' CHECK (publish_method IN ('client_self_publish', 'influencer_publish_with_cart')),

    is_public_apply INTEGER NOT NULL DEFAULT 0 CHECK (is_public_apply IN (0, 1)),

    match_status TEXT NOT NULL DEFAULT 'open' CHECK (match_status IN ('open', 'pending_selection', 'matched', 'completed', 'cancelled')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    completed_at TIMESTAMPTZ,

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

  );

  CREATE INDEX IF NOT EXISTS idx_client_market_orders_open ON client_market_orders (id) WHERE status = 'open';

  CREATE INDEX IF NOT EXISTS idx_client_market_orders_client ON client_market_orders (client_id);

  CREATE INDEX IF NOT EXISTS idx_client_market_orders_influencer ON client_market_orders (influencer_id);

  CREATE INDEX IF NOT EXISTS idx_client_market_orders_created_at ON client_market_orders (created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_client_market_orders_client_created ON client_market_orders (client_id, created_at DESC) WHERE is_deleted = 0;

  CREATE INDEX IF NOT EXISTS idx_client_market_orders_influencer_created ON client_market_orders (influencer_id, created_at DESC) WHERE is_deleted = 0;

  DO $$

  BEGIN

    IF EXISTS (

      SELECT 1

      FROM information_schema.columns

      WHERE table_schema = 'public'

        AND table_name = 'client_market_orders'

        AND column_name = 'match_status'

    ) THEN

      CREATE INDEX IF NOT EXISTS idx_client_market_orders_match_status ON client_market_orders (match_status, created_at DESC) WHERE is_deleted = 0;

    END IF;

  END $$;



  CREATE TABLE IF NOT EXISTS operation_log (

    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL REFERENCES users(id),

    action_type TEXT NOT NULL CHECK (action_type IN ('create', 'edit', 'delete')),

    target_type TEXT NOT NULL CHECK (target_type IN ('intent', 'order', 'task')),

    target_id INTEGER NOT NULL,

    create_time TIMESTAMPTZ NOT NULL DEFAULT now()

  );

  CREATE INDEX IF NOT EXISTS idx_operation_log_user_time ON operation_log (user_id, create_time DESC);



  /**

   */

  CREATE TABLE IF NOT EXISTS client_skus (

    id SERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES users(id),

    sku_code TEXT NOT NULL,

    sku_name TEXT,

    sku_images JSONB NOT NULL DEFAULT '[]'::jsonb,

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

  );

  CREATE INDEX IF NOT EXISTS idx_client_skus_client ON client_skus (client_id, id DESC);

  CREATE INDEX IF NOT EXISTS idx_client_skus_active_client ON client_skus (client_id, id DESC) WHERE is_deleted = 0;

  CREATE INDEX IF NOT EXISTS idx_client_skus_code ON client_skus (sku_code);

  CREATE INDEX IF NOT EXISTS idx_client_skus_name ON client_skus (sku_name);



  /**

   */

  CREATE TABLE IF NOT EXISTS admin_profit_exclusions (

    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),

    created_by INTEGER REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

  );



  /**

   */

  CREATE TABLE IF NOT EXISTS model_profiles (

    id SERIAL PRIMARY KEY,

    name TEXT NOT NULL,

    photos JSONB NOT NULL DEFAULT '[]'::jsonb,

    intro TEXT,

    cloud_link TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled')),

    pending_status TEXT CHECK (pending_status IN ('enabled', 'disabled')),

    created_by INTEGER REFERENCES users(id),

    updated_by INTEGER REFERENCES users(id),

    reviewed_by INTEGER REFERENCES users(id),

    review_note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

  );

  CREATE INDEX IF NOT EXISTS idx_model_profiles_status ON model_profiles(status, id DESC) WHERE is_deleted = 0;



  /**

   */

  CREATE TABLE IF NOT EXISTS client_model_favorites (

    id SERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES users(id),

    model_id INTEGER NOT NULL REFERENCES model_profiles(id),

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(client_id, model_id)

  );

  CREATE INDEX IF NOT EXISTS idx_client_model_favorites_client ON client_model_favorites(client_id, id DESC) WHERE is_deleted = 0;



  CREATE TABLE IF NOT EXISTS market_order_applications (

    id SERIAL PRIMARY KEY,

    market_order_id INTEGER NOT NULL REFERENCES client_market_orders(id),

    influencer_id INTEGER NOT NULL REFERENCES users(id),

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'rejected')),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(market_order_id, influencer_id)

  );

  CREATE INDEX IF NOT EXISTS idx_market_order_applications_order ON market_order_applications(market_order_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_market_order_applications_influencer ON market_order_applications(influencer_id, created_at DESC);



  CREATE TABLE IF NOT EXISTS influencer_collab_demands (

    id SERIAL PRIMARY KEY,

    influencer_id INTEGER NOT NULL REFERENCES users(id),

    title TEXT NOT NULL,

    demand_detail TEXT,

    expected_points INTEGER NOT NULL DEFAULT 5 CHECK (expected_points > 0),

    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'open', 'matched', 'rejected', 'closed')),

    selected_client_id INTEGER REFERENCES users(id),

    review_note TEXT,

    reviewed_by INTEGER REFERENCES users(id),

    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

  );

  CREATE INDEX IF NOT EXISTS idx_influencer_collab_demands_status ON influencer_collab_demands(status, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_influencer_collab_demands_inf ON influencer_collab_demands(influencer_id, created_at DESC);



  CREATE TABLE IF NOT EXISTS influencer_demand_applications (

    id SERIAL PRIMARY KEY,

    demand_id INTEGER NOT NULL REFERENCES influencer_collab_demands(id),

    client_id INTEGER NOT NULL REFERENCES users(id),

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'selected', 'rejected')),

    merchant_shop_name TEXT,

    merchant_product_type TEXT,

    merchant_sales_summary TEXT,

    merchant_shop_link TEXT,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(demand_id, client_id)

  );

  CREATE INDEX IF NOT EXISTS idx_influencer_demand_applications_demand ON influencer_demand_applications(demand_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_influencer_demand_applications_client ON influencer_demand_applications(client_id, created_at DESC);

  ALTER TABLE influencer_demand_applications ADD COLUMN IF NOT EXISTS merchant_shop_name TEXT;

  ALTER TABLE influencer_demand_applications ADD COLUMN IF NOT EXISTS merchant_product_type TEXT;

  ALTER TABLE influencer_demand_applications ADD COLUMN IF NOT EXISTS merchant_sales_summary TEXT;

  ALTER TABLE influencer_demand_applications ADD COLUMN IF NOT EXISTS merchant_shop_link TEXT;

  CREATE TABLE IF NOT EXISTS system_messages (

    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL REFERENCES users(id),

    category TEXT NOT NULL,

    title TEXT NOT NULL,

    content TEXT,

    related_type TEXT,

    related_id INTEGER,

    is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

  );

  CREATE INDEX IF NOT EXISTS idx_system_messages_user_created ON system_messages(user_id, created_at DESC);

`;



/**

 */

export function getPool(): Pool {

  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {

    throw new Error("DATABASE_URL 未配置，请在环境变量中提供 Postgres 连接串。");

  }



  pool = new Pool({

    connectionString,

    // Render Postgres 通常需要 SSL；本地开发环境可不启用。

    ssl: connectionString.includes("render.com") || connectionString.includes("onrender.com") ? ({ rejectUnauthorized: false } as any) : undefined,

  });

  return pool;

}



/**

 */

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {

  const p = getPool();

  const res = await p.query(text, params);

  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };

}



/**

 */

export function normalizePhotosFromDb(value: unknown): string[] {

  if (Array.isArray(value)) {

    return value

      .filter((x) => typeof x === "string")

      .map((x) => String(x).trim())

      .filter(Boolean)

      .slice(0, 20);

  }

  if (typeof value === "string") {

    try {

      return normalizePhotosFromDb(JSON.parse(value));

    } catch {

      return [];

    }

  }

  return [];

}



/**

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

 */

export async function initDb(): Promise<void> {

  if (initialized) return;

  initialized = true;

  const initStartedAt = Date.now();

  const mode = resolveDbInitMode();





  if (mode === "full") {

    await runFullInit();

  } else {

    await runLightweightInit();

    await runFullInit();

  }



  await applyOnlineSchemaPatches();

  await ensureOptionalTables();

  await seedDefaultUsers();

  console.info(`[db.init] mode=${mode} costMs=${Date.now() - initStartedAt}`);

}



/**

 */

async function ensureOptionalTables(): Promise<void> {

  await query(`

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

    )

  `);

  await query(`

    CREATE TABLE IF NOT EXISTS withdrawal_requests (

      id SERIAL PRIMARY KEY,

      user_id INTEGER NOT NULL REFERENCES users(id),

      amount INTEGER NOT NULL CHECK (amount > 0),

      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),

      note TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

      paid_at TIMESTAMPTZ

    )

  `);

  try {

    await query(`

      CREATE TABLE IF NOT EXISTS submission_checks (

        id SERIAL PRIMARY KEY,

        submission_id INTEGER NOT NULL REFERENCES submissions(id),

        check_result TEXT NOT NULL CHECK (check_result IN ('ok', 'deleted', 'suspicious')),

        checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),

        note TEXT

      )

    `);

    await query(`

      CREATE TABLE IF NOT EXISTS influencer_violations (

        id SERIAL PRIMARY KEY,

        user_id INTEGER NOT NULL REFERENCES users(id),

        submission_id INTEGER REFERENCES submissions(id),

        reason TEXT NOT NULL,

        created_at TIMESTAMPTZ NOT NULL DEFAULT now()

      )

    `);

  } catch (e) {

    console.warn("[db.init] optional tables submission_checks / influencer_violations skipped:", e);

  }

}



/**

 */

function envBool(name: string, defaultValue: boolean): boolean {

  const raw = process.env[name];

  if (raw === undefined) return defaultValue;

  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());

}



/**

 */

async function ensureUserIfMissing(username: string, password: string, roleId: number): Promise<void> {

  const existed = await query<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);

  const userId = existed.rows[0]?.id;

  if (userId) {

    await query("INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING", [userId]);

    return;

  }



  const password_hash = await bcrypt.hash(password, 10);

  const created = await query<{ id: number }>("INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id", [username, password_hash, roleId]);

  const createdUserId = created.rows[0]!.id;

  await query("INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING", [createdUserId]);

}



/**

 */

function resolveDbInitMode(): "full" | "lightweight" {

  const raw = (process.env.DB_INIT_MODE || "").trim().toLowerCase();

  if (raw === "full" || raw === "lightweight") return raw;

  return process.env.NODE_ENV === "production" ? "lightweight" : "full";

}



/**

 */

async function runFullInit(): Promise<void> {

  await query(FULL_INIT_SQL);

}



/**

 */

async function runLightweightInit(): Promise<void> {

  const requiredTables = ["roles", "users", "point_accounts", "config", "audit_log"];

  const checked = await query<{ table_name: string }>(

    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",

    [requiredTables]

  );

  if (checked.rowCount !== requiredTables.length) {

    const exists = new Set(checked.rows.map((r) => r.table_name));

    const missing = requiredTables.filter((name) => !exists.has(name));

    throw new Error(`数据库缺少关键表：${missing.join(", ")}。请先使用 DB_INIT_MODE=full 完成初始化。`);

  }

}



/**

 */

async function applyOnlineSchemaPatches(): Promise<void> {

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS influencer_status TEXT NOT NULL DEFAULT 'unapplied'`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_influencer_verified INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_account TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_fans TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS category TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS real_name TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_branch TEXT`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_card TEXT`);
  await query(`ALTER TABLE users DROP COLUMN IF EXISTS contact_info`);
  await query(`CREATE TABLE IF NOT EXISTS influencer_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    show_face INTEGER NOT NULL DEFAULT 0,
    tags TEXT,
    platforms TEXT,
    blacklisted INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    is_premium INTEGER NOT NULL DEFAULT 0,
    can_publish_demand INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query(`ALTER TABLE influencer_profiles ADD COLUMN IF NOT EXISTS is_premium INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE influencer_profiles ADD COLUMN IF NOT EXISTS can_publish_demand INTEGER NOT NULL DEFAULT 0`);
  await query(
    `UPDATE users
        SET influencer_status = CASE
          WHEN influencer_status IN ('unapplied','pending','approved','rejected','disabled') THEN influencer_status
          ELSE 'unapplied'
        END`
  );
  await query(
    `ALTER TABLE users
      ADD CONSTRAINT users_influencer_status_check
      CHECK (influencer_status IN ('unapplied','pending','approved','rejected','disabled'))`
  ).catch(() => undefined);

  await query(`CREATE TABLE IF NOT EXISTS operation_log (

    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL REFERENCES users(id),

    action_type TEXT NOT NULL CHECK (action_type IN ('create', 'edit', 'delete')),

    target_type TEXT NOT NULL CHECK (target_type IN ('intent', 'order', 'task')),

    target_id INTEGER NOT NULL,

    create_time TIMESTAMPTZ NOT NULL DEFAULT now()

  )`);

  await query(`CREATE INDEX IF NOT EXISTS idx_operation_log_user_time ON operation_log (user_id, create_time DESC)`);



  const softDeleteTables = [

    "materials",

    "tasks",

    "task_claims",

    "submissions",

    "client_requests",

    "sample_orders",

    "settlement_records",

    "submission_checks",

    "influencer_violations",

    "withdrawal_requests",

    "recharge_orders",

    "client_market_orders",

  ];

  for (const t of softDeleteTables) {

    await query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS is_deleted INTEGER NOT NULL DEFAULT 0`);

    await query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);

  }



  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS biz_status TEXT NOT NULL DEFAULT 'open'`);

  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS claimed_count INTEGER NOT NULL DEFAULT 0`);

  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS fulfilled_count INTEGER NOT NULL DEFAULT 0`);

  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tiktok_link TEXT`);

  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS product_images JSONB NOT NULL DEFAULT '[]'::jsonb`);

  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sku_codes JSONB NOT NULL DEFAULT '[]'::jsonb`);

  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sku_images JSONB NOT NULL DEFAULT '[]'::jsonb`);



  const mo = await query<{ exists: boolean }>(

    `SELECT EXISTS (

      SELECT 1 FROM information_schema.tables

      WHERE table_schema = 'public' AND table_name = 'client_market_orders'

    ) AS exists`,

  );

  if (mo.rows[0]?.exists) {

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS order_no TEXT`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS title TEXT`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'C'`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS creator_reward_points INTEGER NOT NULL DEFAULT 5`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS platform_profit_points INTEGER NOT NULL DEFAULT 0`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS pay_deducted INTEGER NOT NULL DEFAULT 0`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS voice_link TEXT`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS voice_note TEXT`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS tiktok_link TEXT`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS product_images JSONB NOT NULL DEFAULT '[]'::jsonb`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS sku_codes JSONB NOT NULL DEFAULT '[]'::jsonb`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS sku_images JSONB NOT NULL DEFAULT '[]'::jsonb`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS sku_ids JSONB NOT NULL DEFAULT '[]'::jsonb`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS client_shop_name TEXT`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS client_group_chat TEXT`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS publish_method TEXT NOT NULL DEFAULT 'client_self_publish'`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS is_public_apply INTEGER NOT NULL DEFAULT 0`);
    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS allow_apply INTEGER NOT NULL DEFAULT 1`);

    await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS match_status TEXT NOT NULL DEFAULT 'open'`);

    await query(

      `UPDATE client_market_orders

         SET publish_method = 'client_self_publish'

       WHERE publish_method IS NULL

          OR publish_method NOT IN ('client_self_publish', 'influencer_publish_with_cart')`,

    );

    await query(

      `UPDATE client_market_orders SET order_no = 'XT-LEGACY-' || id::text WHERE order_no IS NULL`,

    );

    await query(

      `UPDATE client_market_orders

         SET platform_profit_points = GREATEST(reward_points - creator_reward_points, 0)

       WHERE (platform_profit_points IS NULL OR platform_profit_points = 0) AND reward_points IS NOT NULL`,

    );

    await query(

      `CREATE UNIQUE INDEX IF NOT EXISTS idx_client_market_orders_order_no ON client_market_orders(order_no) WHERE order_no IS NOT NULL`,

    );

    await query(`CREATE INDEX IF NOT EXISTS idx_client_market_orders_created_at ON client_market_orders(created_at DESC)`);

    await query(`CREATE INDEX IF NOT EXISTS idx_client_market_orders_client_created ON client_market_orders(client_id, created_at DESC) WHERE is_deleted = 0`);

    await query(`CREATE INDEX IF NOT EXISTS idx_client_market_orders_influencer_created ON client_market_orders(influencer_id, created_at DESC) WHERE is_deleted = 0`);

    await query(`CREATE INDEX IF NOT EXISTS idx_client_market_orders_match_status ON client_market_orders (match_status, created_at DESC) WHERE is_deleted = 0`);

  }

  await query(`CREATE TABLE IF NOT EXISTS client_skus (

    id SERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES users(id),

    sku_code TEXT NOT NULL,

    sku_name TEXT,

    sku_images JSONB NOT NULL DEFAULT '[]'::jsonb,

    is_deleted INTEGER NOT NULL DEFAULT 0,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

  )`);

  await query(`CREATE INDEX IF NOT EXISTS idx_client_skus_client ON client_skus (client_id, id DESC)`);

  await query(`CREATE INDEX IF NOT EXISTS idx_client_skus_active_client ON client_skus (client_id, id DESC) WHERE is_deleted = 0`);

  await query(`CREATE INDEX IF NOT EXISTS idx_client_skus_code ON client_skus (sku_code)`);

  await query(`CREATE INDEX IF NOT EXISTS idx_client_skus_name ON client_skus (sku_name)`);

  await query(`CREATE TABLE IF NOT EXISTS admin_profit_exclusions (

    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),

    created_by INTEGER REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()

  )`);

  await query(`CREATE TABLE IF NOT EXISTS model_profiles (

    id SERIAL PRIMARY KEY,

    name TEXT NOT NULL,

    photos JSONB NOT NULL DEFAULT '[]'::jsonb,

    intro TEXT,

    cloud_link TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'disabled',

    pending_status TEXT,

    created_by INTEGER REFERENCES users(id),

    updated_by INTEGER REFERENCES users(id),

    reviewed_by INTEGER REFERENCES users(id),

    review_note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    is_deleted INTEGER NOT NULL DEFAULT 0,

    deleted_at TIMESTAMPTZ

  )`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS pending_status TEXT`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id)`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id)`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS review_note TEXT`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS is_deleted INTEGER NOT NULL DEFAULT 0`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS tiktok_followers_text TEXT`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS tiktok_sales_text TEXT`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS sellable_product_types TEXT`);

  await query(`ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS skills_text TEXT`);

  await query(`CREATE INDEX IF NOT EXISTS idx_model_profiles_status ON model_profiles(status, id DESC) WHERE is_deleted = 0`);

  await query(`CREATE TABLE IF NOT EXISTS client_model_favorites (

    id SERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES users(id),

    model_id INTEGER NOT NULL REFERENCES model_profiles(id),

    is_deleted INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(client_id, model_id)

  )`);

  await query(`ALTER TABLE client_model_favorites ADD COLUMN IF NOT EXISTS is_deleted INTEGER NOT NULL DEFAULT 0`);

  await query(`ALTER TABLE client_model_favorites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`);

  await query(`CREATE INDEX IF NOT EXISTS idx_client_model_favorites_client ON client_model_favorites(client_id, id DESC) WHERE is_deleted = 0`);

  await query(`CREATE TABLE IF NOT EXISTS merchant_profiles (
    client_id INTEGER PRIMARY KEY REFERENCES users(id),
    member_level INTEGER NOT NULL DEFAULT 0 CHECK (member_level IN (0,1,2,3)),
    member_expire_time TIMESTAMPTZ,
    deposit_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    deposit_frozen NUMERIC(18,2) NOT NULL DEFAULT 0,
    deposit_status TEXT NOT NULL DEFAULT 'none' CHECK (deposit_status IN ('none','active','frozen','warning')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS member_orders (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id),
    member_level INTEGER NOT NULL CHECK (member_level IN (1,2,3)),
    amount NUMERIC(18,2) NOT NULL,
    months INTEGER NOT NULL DEFAULT 1 CHECK (months > 0),
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expire_time TIMESTAMPTZ
  )`);

  await query(`CREATE TABLE IF NOT EXISTS deposit_log (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES users(id),
    change_amount NUMERIC(18,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('pay','freeze','unfreeze','deduct','refund')),
    ref_order_id INTEGER,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  await query(`CREATE INDEX IF NOT EXISTS idx_member_orders_client ON member_orders(client_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_deposit_log_client ON deposit_log(client_id, created_at DESC)`);
  await query(`ALTER TABLE system_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ`);

  await query(`CREATE TABLE IF NOT EXISTS matching_order_details (
    order_id INTEGER PRIMARY KEY REFERENCES client_market_orders(id) ON DELETE CASCADE,
    detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS order_type INTEGER NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS allow_apply INTEGER NOT NULL DEFAULT 1`);
  await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS task_amount NUMERIC(18,2)`);
  await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS deposit_frozen NUMERIC(18,2) NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS task_count INTEGER NOT NULL DEFAULT 1`);

  await query(`CREATE TABLE IF NOT EXISTS task_applies (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES client_market_orders(id),
    influencer_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','selected','rejected','in_progress','completed')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(task_id, influencer_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_task_applies_task ON task_applies(task_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_task_applies_influencer ON task_applies(influencer_id, created_at DESC)`);

  await query(`CREATE TABLE IF NOT EXISTS demand (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    expected_commission TEXT NOT NULL,
    requirement TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','open','matched','rejected','closed')),
    selected_client_id INTEGER REFERENCES users(id),
    review_note TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_demand_influencer ON demand(influencer_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_demand_status ON demand(status, created_at DESC)`);

  await query(`CREATE TABLE IF NOT EXISTS demand_applies (
    id SERIAL PRIMARY KEY,
    demand_id INTEGER NOT NULL REFERENCES demand(id),
    client_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','selected','rejected')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(demand_id, client_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_demand_applies_demand ON demand_applies(demand_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_demand_applies_client ON demand_applies(client_id, created_at DESC)`);

  await query(`CREATE TABLE IF NOT EXISTS showcase_influencers (

    id SERIAL PRIMARY KEY,

    name TEXT NOT NULL,

    intro TEXT,

    photos JSONB NOT NULL DEFAULT '[]'::jsonb,

    tiktok_followers_text TEXT,

    sales_text TEXT,

    sellable_types_text TEXT,

    skills_text TEXT,

    video_url TEXT,

    status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled')),

    created_by INTEGER REFERENCES users(id),

    updated_by INTEGER REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

  )`);

  await query(`ALTER TABLE showcase_influencers ADD COLUMN IF NOT EXISTS skills_text TEXT`);

  await query(`ALTER TABLE showcase_influencers ADD COLUMN IF NOT EXISTS video_url TEXT`);

  await query(`ALTER TABLE showcase_influencers DROP COLUMN IF EXISTS fee_quote_text`);

  await query(`ALTER TABLE showcase_influencers DROP COLUMN IF EXISTS tiktok_url`);

  await query(`CREATE INDEX IF NOT EXISTS idx_showcase_influencers_status ON showcase_influencers(status, id DESC) WHERE is_deleted = 0`);

  await query(`CREATE TABLE IF NOT EXISTS showcase_content_creators (

    id SERIAL PRIMARY KEY,

    name TEXT NOT NULL,

    intro TEXT,

    photos JSONB NOT NULL DEFAULT '[]'::jsonb,

    shoot_types_text TEXT,

    skills_text TEXT,

    video_url TEXT,

    status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled')),

    created_by INTEGER REFERENCES users(id),

    updated_by INTEGER REFERENCES users(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),

    deleted_at TIMESTAMPTZ

  )`);

  await query(`ALTER TABLE showcase_content_creators DROP COLUMN IF EXISTS tier`);

  await query(`ALTER TABLE showcase_content_creators DROP COLUMN IF EXISTS social_url`);

  await query(`ALTER TABLE showcase_content_creators ADD COLUMN IF NOT EXISTS skills_text TEXT`);

  await query(`ALTER TABLE showcase_content_creators ADD COLUMN IF NOT EXISTS video_url TEXT`);

  await query(`ALTER TABLE showcase_content_creators DROP COLUMN IF EXISTS fee_quote_text`);

  await query(`CREATE INDEX IF NOT EXISTS idx_showcase_content_creators_status ON showcase_content_creators(status, id DESC) WHERE is_deleted = 0`);

  await query(`CREATE TABLE IF NOT EXISTS client_showcase_influencer_favorites (

    id SERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES users(id),

    showcase_influencer_id INTEGER NOT NULL REFERENCES showcase_influencers(id),

    is_deleted INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(client_id, showcase_influencer_id)

  )`);

  await query(`ALTER TABLE client_showcase_influencer_favorites ADD COLUMN IF NOT EXISTS is_deleted INTEGER NOT NULL DEFAULT 0`);

  await query(`ALTER TABLE client_showcase_influencer_favorites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`);

  await query(`CREATE INDEX IF NOT EXISTS idx_client_showcase_inf_fav ON client_showcase_influencer_favorites(client_id, id DESC) WHERE is_deleted = 0`);

  await query(`CREATE TABLE IF NOT EXISTS client_showcase_creator_favorites (

    id SERIAL PRIMARY KEY,

    client_id INTEGER NOT NULL REFERENCES users(id),

    showcase_content_creator_id INTEGER NOT NULL REFERENCES showcase_content_creators(id),

    is_deleted INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(client_id, showcase_content_creator_id)

  )`);

  await query(`ALTER TABLE client_showcase_creator_favorites ADD COLUMN IF NOT EXISTS is_deleted INTEGER NOT NULL DEFAULT 0`);

  await query(`ALTER TABLE client_showcase_creator_favorites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`);

  await query(`CREATE INDEX IF NOT EXISTS idx_client_showcase_cc_fav ON client_showcase_creator_favorites(client_id, id DESC) WHERE is_deleted = 0`);



  // 达人领单：work_links JSONB 多条交付链接；迁移 work_link；移除 requirements

  await query(`ALTER TABLE client_market_orders ADD COLUMN IF NOT EXISTS work_links JSONB NOT NULL DEFAULT '[]'::jsonb`);

  const _wl = await query<{ exists: boolean }>(

    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_market_orders' AND column_name = 'work_link') AS exists`,

  );

  if (_wl.rows[0]?.exists) {

    await query(

      `UPDATE client_market_orders SET work_links = CASE WHEN work_link IS NOT NULL AND TRIM(work_link) <> '' THEN jsonb_build_array(TRIM(work_link)) ELSE '[]'::jsonb END`,

    );

    await query(`ALTER TABLE client_market_orders DROP COLUMN work_link`);

  }

  const _rq = await query<{ exists: boolean }>(

    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_market_orders' AND column_name = 'requirements') AS exists`,

  );

  if (_rq.rows[0]?.exists) {

    await query(

      `UPDATE client_market_orders SET title = LEFT(TRIM(COALESCE(requirements, '')), 200) WHERE (title IS NULL OR TRIM(COALESCE(title, '')) = '') AND requirements IS NOT NULL AND TRIM(COALESCE(requirements, '')) <> ''`,

    );

    await query(`UPDATE client_market_orders SET title = '未命名订单' WHERE title IS NULL OR TRIM(COALESCE(title, '')) = ''`);

    await query(`ALTER TABLE client_market_orders DROP COLUMN requirements`);

  }





}





/**

 */

async function seedDefaultUsers(): Promise<void> {

  await ensureUserIfMissing("admin", "admin123", 1);

  await ensureUserIfMissing("employee001", "123456", 4);



  const seedDemo = envBool("SEED_DEMO_USERS", true);

  if (!seedDemo) return;



  const clientUsername = process.env.SEED_CLIENT_USERNAME || "client002";

  const clientPassword = process.env.SEED_CLIENT_PASSWORD || "123456";

  const influencerUsername = process.env.SEED_INFLUENCER_USERNAME || "influencer002";

  const influencerPassword = process.env.SEED_INFLUENCER_PASSWORD || "123456";



  await ensureUserIfMissing(clientUsername, clientPassword, 2);

  await ensureUserIfMissing(influencerUsername, influencerPassword, 3);

}

