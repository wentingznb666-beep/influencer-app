import { useEffect, useState } from "react";
import * as matchingApi from "../matchingApi";

type Row = {
  id: number;
  username: string;
  display_name: string;
  is_premium: number;
  can_publish_demand: number;
};

export default function CreatorPublishPermissionsPage() {
  const [list, setList] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await matchingApi.getAdminPremiumCreators();
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (row: Row) => {
    setError(null);
    try {
      await matchingApi.updateAdminPremiumCreator(row.id, Number(row.can_publish_demand || 0) !== 1);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{"达人发布权限"}</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <button type="button" onClick={load} style={{ marginBottom: 12 }}>{"刷新"}</button>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8 }}>{"账号"}</th>
            <th style={{ textAlign: "left", padding: 8 }}>{"名称"}</th>
            <th style={{ textAlign: "left", padding: 8 }}>{"优质达人"}</th>
            <th style={{ textAlign: "left", padding: 8 }}>{"发品权限"}</th>
            <th style={{ textAlign: "left", padding: 8 }}>{"操作"}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((row) => (
            <tr key={row.id}>
              <td style={{ padding: 8 }}>{row.username}</td>
              <td style={{ padding: 8 }}>{row.display_name}</td>
              <td style={{ padding: 8 }}>{Number(row.is_premium || 0) === 1 ? "是" : "否"}</td>
              <td style={{ padding: 8 }}>{Number(row.can_publish_demand || 0) === 1 ? "已开通" : "未开通"}</td>
              <td style={{ padding: 8 }}><button type="button" onClick={() => toggle(row)}>{Number(row.can_publish_demand || 0) === 1 ? "关闭" : "开通"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
