/**
 * 外网访问：启动 ngrok 并更新前端接口地址
 * 使用前请先执行一次：ngrok config add-authtoken <你的token>
 * 运行：node start-ngrok.js  或  npm run ngrok
 */

const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");
const os = require("os");

const backendDir = __dirname;
const frontendEnv = path.join(backendDir, "..", "frontend", ".env");
const configPath = path.join(backendDir, "ngrok.yml");

/** 解析 ngrok 可执行文件路径，避免 Node 子进程找不到 PATH 中的 ngrok */
function getNgrokPath() {
  try {
    const out = execSync("where ngrok", { encoding: "utf8", windowsHide: true });
    const first = out.trim().split("\n")[0].trim();
    if (first) return first;
  } catch (_) {}
  if (os.platform() === "win32") {
    const local = process.env.LOCALAPPDATA || "";
    const links = path.join(local, "Microsoft", "WinGet", "Links", "ngrok.exe");
    if (fs.existsSync(links)) return links;
    const packages = path.join(local, "Microsoft", "WinGet", "Packages");
    if (fs.existsSync(packages)) {
      const dirs = fs.readdirSync(packages);
      for (const d of dirs) {
        if (d.toLowerCase().includes("ngrok")) {
          const exe = path.join(packages, d, "ngrok.exe");
          if (fs.existsSync(exe)) return exe;
        }
      }
    }
  }
  return "ngrok";
}

const ngrokExe = getNgrokPath();
console.log("正在启动 ngrok（backend + frontend）...");
const p = spawn(ngrokExe, ["start", "--config", configPath, "backend", "frontend"], {
  cwd: backendDir,
  stdio: "ignore",
  detached: true,
  shell: false,
  windowsHide: true,
});
p.unref();

setTimeout(() => {
  http
    .get("http://127.0.0.1:4040/api/tunnels", (res) => {
      let body = "";
      res.on("data", (ch) => (body += ch));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          const tunnels = data.tunnels || [];
          let backendUrl = null;
          let frontendUrl = null;
          for (const t of tunnels) {
            if (t.name === "backend") backendUrl = t.public_url;
            if (t.name === "frontend") frontendUrl = t.public_url;
          }
          if (!backendUrl || !frontendUrl) {
            console.error("未获取到隧道地址，请稍等几秒后访问 http://127.0.0.1:4040 查看。");
            process.exit(1);
          }
          let content = fs.readFileSync(frontendEnv, "utf8");
          content = content.replace(/VITE_API_BASE_URL=.*/, `VITE_API_BASE_URL=${backendUrl}`);
          fs.writeFileSync(frontendEnv, content.trimEnd());
          console.log("已写入后端公网地址到 frontend\\.env：" + backendUrl);
          console.log("");
          console.log("外网访问地址（在手机或任意浏览器打开）：");
          console.log("  " + frontendUrl);
          console.log("");
          console.log("请在前端所在终端按 Ctrl+C 停止后重新执行：cd D:\\frontend && npm run dev");
          console.log("ngrok 正在后台运行，关闭本窗口会结束隧道。");
        } catch (e) {
          console.error("无法读取 ngrok 隧道信息。请确认已执行：ngrok config add-authtoken <你的token>");
          console.error("然后手动执行：cd D:\\backend && ngrok start --config ngrok.yml backend frontend");
          process.exit(1);
        }
      });
    })
    .on("error", () => {
      console.error("无法连接 ngrok 本地 API。");
      console.error("请确认：1) 已执行 ngrok config add-authtoken <你的token>");
      console.error("       2) 本机已安装 ngrok 且在新开的终端中运行此脚本（或已将 ngrok 所在目录加入 PATH）");
      process.exit(1);
    });
}, 5000);
