/**
 * 系统通知提示音工具。
 * 使用 Web Audio API 生成简单的提示音，无需外部音频文件。
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * 播放新订单/新任务通知提示音。
 * 一个短促的三音上升提示音，清晰但不刺耳。
 */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // 三个音符：C5(523) -> E5(659) -> G5(784)，每个 100ms，间隔 30ms
    const notes = [523.25, 659.25, 783.99];
    const noteDuration = 0.1;
    const gap = 0.03;

    notes.forEach((freq, i) => {
      const start = now + i * (noteDuration + gap);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.01);
      gain.gain.linearRampToValueAtTime(0, start + noteDuration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + noteDuration);
    });
  } catch {
    // 用户未与页面交互前 AudioContext 可能处于 suspended 状态，静默忽略
  }
}

/** 小程序/轻量版通知音：更短的单个提示音 */
export function playClickSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.005);
    gain.gain.linearRampToValueAtTime(0, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // 静默忽略
  }
}

/**
 * 唤醒或恢复 AudioContext（解决浏览器自动播放策略）。
 * 应在用户首次点击/触摸时调用。
 */
export function resumeAudioContext(): void {
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}
