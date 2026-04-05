#!/usr/bin/env sh
# 在 Render：Web Service → Shell 中执行本脚本（或复制其中命令），用于创建上传目录。
# UPLOADS_ROOT 须与 Environment 中配置及持久盘挂载路径一致；未设置时默认 /var/render/uploads。
#
# 用法：
#   sh scripts/render-shell-uploads-init.sh           # 仅创建 models、skus 顶层目录
#   sh scripts/render-shell-uploads-init.sh 1       # 额外创建 models/1（用户 ID 为 1）
#   sh scripts/render-shell-uploads-init.sh 1 2 3    # 创建 models/1 models/2 models/3

set -e
UPLOADS_ROOT="${UPLOADS_ROOT:-/var/render/uploads}"

echo "[uploads] UPLOADS_ROOT=${UPLOADS_ROOT}"
mkdir -p "${UPLOADS_ROOT}/models" "${UPLOADS_ROOT}/skus"

for uid in "$@"; do
  if [ -n "$uid" ]; then
    mkdir -p "${UPLOADS_ROOT}/models/${uid}"
    echo "[uploads] created: ${UPLOADS_ROOT}/models/${uid}"
  fi
done

echo "[uploads] listing ${UPLOADS_ROOT}:"
ls -la "${UPLOADS_ROOT}"
if [ "$#" -gt 0 ]; then
  echo "[uploads] listing models:"
  ls -la "${UPLOADS_ROOT}/models" || true
fi
