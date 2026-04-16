/**
 * 使用 localtunnel 生成外网可访问地址（无需注册）
 * 会同时暴露后端(3000)和前端(当前端口，默认5180)，并更新 frontend\.env
 * 运行：node start-localtunnel.js  或  npm run tunnel
 * 保持本窗口不关闭，隧道才会有效。
 */

const http = require("http");
const path = require("path");
const fs = require("fs");
const backendDir = __dirname;
const frontendEnv = path.join(backendDir, "..", "frontend", ".env");

const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5180;

async function main() {
  const lt = require("localtunnel");
  console.log("正在创建外网隧道（backend %d + frontend %d）...", BACKEND_PORT, FRONTEND_PORT);
  const backendTunnel = await lt({ port: BACKEND_PORT });
  const frontendTunnel = await lt({ port: FRONTEND_PORT });
  const backendUrl = backendTunnel.url.replace(/^http:/, "https:");
  const frontendUrl = frontendTunnel.url.replace(/^http:/, "https:");

  let content = fs.readFileSync(frontendEnv, "utf8");
  content = content.replace(/VITE_API_BASE_URL=.*/, `VITE_API_BASE_URL=${backendUrl}`);
  fs.writeFileSync(frontendEnv, content.trimEnd());
  console.log("已写入后端公网地址到 frontend\\.env");
  console.log("");
  console.log("外网访问地址（在手机或任意浏览器打开）：");
  console.log("  " + frontendUrl);
  console.log("");
  console.log("请在前端终端按 Ctrl+C 停止后重新执行：cd D:\\frontend && npm run dev");
  console.log("本窗口保持打开，隧道有效；关闭后外网地址失效。");
  process.stdin.resume();
}

main().catch((e) => {
  console.error("创建隧道失败：", e.message);
  process.exit(1);
});
