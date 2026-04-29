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

export type ToastVariant = "info" | "success" | "error";
export type ToastPlacement = "bottom" | "top" | "top-right";
export type ToastOptions = {
  durationMs?: number;
  variant?: ToastVariant;
  placement?: ToastPlacement;
  closable?: boolean;
};

export function showToastNotice(message: string, options: ToastOptions = {}): void {
  if (typeof document === "undefined") return;

  const durationMs = Number.isFinite(options.durationMs) ? Number(options.durationMs) : 4200;
  const variant: ToastVariant = options.variant || "info";
  const placement: ToastPlacement = options.placement || "top-right";
  const closable = options.closable !== false;

  const stackId = placement === "top" ? "xt-toast-stack-top" : placement === "bottom" ? "xt-toast-stack-bottom" : "xt-toast-stack-top-right";
  let stack = document.getElementById(stackId);
  if (!stack) {
    stack = document.createElement("div");
    stack.id = stackId;
    stack.className =
      placement === "top"
        ? "xt-toast-stack xt-toast-stack--top"
        : placement === "bottom"
          ? "xt-toast-stack xt-toast-stack--bottom"
          : "xt-toast-stack xt-toast-stack--top-right";
    document.body.appendChild(stack);
  }

  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.className = `xt-toast2 xt-toast2--${variant}`;

  const text = document.createElement("div");
  text.className = "xt-toast2__text";
  text.textContent = message;
  el.appendChild(text);

  let removeTimer: number | undefined;

  const removeWithAnim = () => {
    if (!el.isConnected) return;
    if (removeTimer != null) window.clearTimeout(removeTimer);
    el.classList.add("xt-toast2--out");
    window.setTimeout(() => {
      el.remove();
      if (stack && stack.childElementCount === 0) stack.remove();
    }, 220);
  };

  if (closable) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "xt-toast2__close";
    btn.setAttribute("aria-label", "关闭");
    btn.textContent = "×";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeWithAnim();
    });
    el.appendChild(btn);
    el.addEventListener("click", () => removeWithAnim());
  }

  stack.appendChild(el);

  removeTimer = window.setTimeout(() => removeWithAnim(), durationMs);
}
