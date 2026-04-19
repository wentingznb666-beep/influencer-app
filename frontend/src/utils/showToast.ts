/**
 * 在视口底部居中展示轻量提示，不经过 React 根更新，避免干扰自动翻译与首屏渲染。
 * @param message 展示文案
 * @param durationMs 停留毫秒数
 */
export function showToast(message: string, durationMs = 2600): void {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.className = "xt-toast";
  el.textContent = message;
  document.body.appendChild(el);
  window.setTimeout(() => {
    el.classList.add("xt-toast--out");
    window.setTimeout(() => el.remove(), 220);
  }, durationMs);
}
