import { useEffect, useRef } from "react";

/**
 * 锁定背景页面滚动，防止弹窗打开时的滚动穿透问题。
 * 当 `locked` 为 true 时，禁止 body 滚动；为 false 时恢复。
 * 支持多个弹窗同时存在的情况（引用计数）。
 */
let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

export function useScrollLock(locked: boolean) {
  const wasLockedRef = useRef(false);

  useEffect(() => {
    if (locked && !wasLockedRef.current) {
      // 锁定
      wasLockedRef.current = true;
      lockCount++;
      if (lockCount === 1) {
        // 第一个锁：保存原始值并锁定
        savedOverflow = document.body.style.overflow;
        savedPaddingRight = document.body.style.paddingRight;
        // 计算滚动条宽度，避免锁定时页面抖动
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
      }
    } else if (!locked && wasLockedRef.current) {
      // 解锁
      wasLockedRef.current = false;
      lockCount--;
      if (lockCount === 0) {
        // 最后一个锁解除：恢复原始值
        document.body.style.overflow = savedOverflow;
        document.body.style.paddingRight = savedPaddingRight;
      }
    }

    return () => {
      if (wasLockedRef.current) {
        wasLockedRef.current = false;
        lockCount--;
        if (lockCount === 0) {
          document.body.style.overflow = savedOverflow;
          document.body.style.paddingRight = savedPaddingRight;
        }
      }
    };
  }, [locked]);
}
