import { query } from "./db";
import type { RoleName } from "./auth";

export const COOPERATION_TYPES_CONFIG_KEY = "cooperation_types_v1";

export type CooperationTypeId = "graded_video" | "high_quality_custom_video" | "monthly_package" | "creator_review_video";

export type CooperationTypesConfig = {
  version: 1;
  types: Array<{
    id: CooperationTypeId;
    name: { zh: string; th: string };
    visible_roles: RoleName[];
    spec: Record<string, unknown>;
  }>;
};

export function getDefaultCooperationTypesConfig(): CooperationTypesConfig {
  return {
    version: 1,
    types: [
      {
        id: "graded_video",
        name: { zh: "分级视频（A/B/C）", th: "คลิปแบ่งเกรด (A/B/C)" },
        visible_roles: ["admin", "employee", "client"],
        spec: {
          point_rate_thb: 1,
          shoot_by: "offline_part_time",
          publish_options: ["client_self_publish", "tap_creator_publish"],
          role_split: { shooter: "part_time", publisher: "creator" },
          pricing_points: {
            client: { A: 60, B: 40, C: 20 },
            part_time: { A: 15, B: 10, C: 5 },
          },
          rules: {
            no_face: true,
            no_script: true,
            no_revision: true,
            start_after_paid: true,
          },
        },
      },
      {
        id: "high_quality_custom_video",
        name: { zh: "高质量定制视频", th: "วิดีโอคุณภาพสูงแบบกำหนดเอง" },
        visible_roles: ["admin", "employee", "client"],
        spec: {
          merchant_price_thb_range: { min: 4000, max: 5000 },
          executed_by: "premium_influencer",
          allow_face: true,
          allow_script: true,
          revisions: { min: 1, max: 2 },
          publish: { by_influencer_account: true, ads_allowed: true },
        },
      },
      {
        id: "monthly_package",
        name: { zh: "包月长期合作套餐", th: "แพ็กเกจความร่วมมือรายเดือน" },
        visible_roles: ["admin", "employee", "client"],
        spec: {
          min_videos_per_month: 20,
          merchant_price_per_video_thb: 650,
          deliverables: { final_video: true, raw_footage: true },
          revisions_first_n: 4,
          publish: { by_client: true },
        },
      },
      {
        id: "creator_review_video",
        name: { zh: "Creator带货测评视频", th: "วิดีโอรีวิวขายของโดย Creator" },
        visible_roles: ["admin", "employee", "client"],
        spec: {
          requires_tap: true,
          allow_face: true,
          deliverables_count_range: { min: 8, max: 10 },
          merchant_price_thb: null,
          must_review_before_publish: true,
        },
      },
    ],
  };
}

export async function ensureCooperationTypesConfig(): Promise<void> {
  await query(
    "INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
    [COOPERATION_TYPES_CONFIG_KEY, JSON.stringify(getDefaultCooperationTypesConfig())]
  );
}

export async function readCooperationTypesConfig(): Promise<CooperationTypesConfig> {
  await ensureCooperationTypesConfig();
  const row = await query<{ value: string }>("SELECT value FROM config WHERE key=$1", [COOPERATION_TYPES_CONFIG_KEY]);
  const raw = row.rows[0]?.value;
  if (!raw) return getDefaultCooperationTypesConfig();
  try {
    const parsed = JSON.parse(raw) as CooperationTypesConfig;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.types)) return getDefaultCooperationTypesConfig();
    return parsed;
  } catch {
    return getDefaultCooperationTypesConfig();
  }
}

export function isVisibleCooperationType(config: CooperationTypesConfig, typeId: string, role: RoleName): boolean {
  const item = config.types.find((t) => t.id === typeId);
  if (!item) return false;
  return Array.isArray(item.visible_roles) && item.visible_roles.includes(role);
}

