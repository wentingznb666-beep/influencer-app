import { describe, expect, it, vi } from "vitest";
import {
  computeBackoffMs,
  defaultPathTranslatePriority,
  mergePendingByMinPriority,
  sortPendingForBatch,
} from "./translateQueue";

describe("跨端口路由默认优先级", () => {
  it("管理端优先于达人端", () => {
    expect(defaultPathTranslatePriority("/admin/market-orders")).toBeLessThan(
      defaultPathTranslatePriority("/influencer/client-orders"),
    );
  });

  it("员工端优先于商家端", () => {
    expect(defaultPathTranslatePriority("/employee/orders")).toBeLessThan(
      defaultPathTranslatePriority("/client/market-orders"),
    );
  });
});

describe("翻译待请求排序", () => {
  it("合并同一 key 时保留更小优先级", () => {
    const merged = mergePendingByMinPriority([
      { key: "同一", pri: 30 },
      { key: "同一", pri: 10 },
    ]);
    expect(merged).toEqual([{ key: "同一", pri: 10 }]);
  });

  it("同优先级按文本长度降序", () => {
    const keys = sortPendingForBatch([
      { key: "短", pri: 10 },
      { key: "更长文本", pri: 10 },
      { key: "中", pri: 20 },
    ]);
    expect(keys).toEqual(["更长文本", "短", "中"]);
  });
});

describe("指数退避", () => {
  it("不超过上限", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(computeBackoffMs(20, 500, 30_000)).toBeLessThanOrEqual(30_000);
    vi.restoreAllMocks();
  });
});
