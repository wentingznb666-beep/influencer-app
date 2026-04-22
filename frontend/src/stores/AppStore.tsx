import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type MerchantTemplateState = {
  shop_name: string;
  product_type: string;
  sales_summary: string;
  shop_link: string;
  shop_rating: string;
  user_reviews: string;
};

export type ExpandedGroupsState = {
  points: boolean;
  match: boolean;
  common: boolean;
};

export type AppStoreValue = {
  role: string | null;
  setRole: Dispatch<SetStateAction<string | null>>;
  merchantTemplate: MerchantTemplateState;
  setMerchantTemplate: Dispatch<SetStateAction<MerchantTemplateState>>;
  expandedGroups: ExpandedGroupsState;
  setExpandedGroups: Dispatch<SetStateAction<ExpandedGroupsState>>;
  toggleExpandedGroup: (gid: keyof ExpandedGroupsState) => void;
};

const MERCHANT_TEMPLATE_KEY = "app:merchantTemplate";
const EXPANDED_GROUPS_KEY = "app:expandedGroups";

const defaultMerchantTemplate: MerchantTemplateState = {
  shop_name: "",
  product_type: "",
  sales_summary: "",
  shop_link: "",
  shop_rating: "",
  user_reviews: "",
};

const defaultExpandedGroups: ExpandedGroupsState = {
  points: true,
  match: false,
  common: false,
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

/** Read persisted JSON safely. */

function readJsonState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Initialize the global store state. */
export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [merchantTemplate, setMerchantTemplate] = useState<MerchantTemplateState>(() =>
    readJsonState<MerchantTemplateState>(MERCHANT_TEMPLATE_KEY, defaultMerchantTemplate),
  );
  const [expandedGroups, setExpandedGroups] = useState<ExpandedGroupsState>(() =>
    readJsonState<ExpandedGroupsState>(EXPANDED_GROUPS_KEY, defaultExpandedGroups),
  );

  /** 切换侧栏某业务分组的展开/收起。 */
  const toggleExpandedGroup = (gid: keyof ExpandedGroupsState) => {
    setExpandedGroups((prev) => ({ ...prev, [gid]: !prev[gid] }));
  };

  useEffect(() => {
    try {
      localStorage.setItem(MERCHANT_TEMPLATE_KEY, JSON.stringify(merchantTemplate));
    } catch {
      // localStorage 不可用或写入失败时忽略持久化。
    }
  }, [merchantTemplate]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify(expandedGroups));
    } catch {
      // localStorage 不可用或写入失败时忽略持久化。
    }
  }, [expandedGroups]);

  const value: AppStoreValue = {
    role,
    setRole,
    merchantTemplate,
    setMerchantTemplate,
    expandedGroups,
    setExpandedGroups,
    toggleExpandedGroup,
  };

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

/** Read global state inside AppStoreProvider only. */

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}
