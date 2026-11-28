#!/usr/bin/env bash
# Point AMBA + Amba-GM at https://amba-gm.unwhelm.online (run on VPS).
set -eu
ORIGIN="https://amba-gm.unwhelm.online"
AMBA_ENV="${HOME}/node-sites/AdventureMakerByAct/.env"
GM_DIR="${HOME}/node-sites/Amba-GM"

replace_or_append() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$file"
  fi
}

test -f "$AMBA_ENV"
replace_or_append "$AMBA_ENV" "AMBA_GM_RUNTIME_ORIGIN" "$ORIGIN"
AMBA_GM_RUNTIME_ORIGIN="$ORIGIN" bash "$GM_DIR/tools/update-vps-env.sh"
echo "Set AMBA_GM_RUNTIME_ORIGIN=$ORIGIN on AMBA and Amba-GM."
echo "Redeploy AdventureMakerByAct and restart amba-api PM2 for CORS + grant audience."