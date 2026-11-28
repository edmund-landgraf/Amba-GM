#!/usr/bin/env bash
set -eu
AMBA_ENV="${AMBA_ENV:-$HOME/node-sites/AdventureMakerByAct/.env}"
GM_ENV="${GM_ENV:-$HOME/node-sites/Amba-GM/.env}"
DATA_DIR="${AMBA_GM_DATA_DIR:-$HOME/amba-gm-data}"
ORIGIN="${AMBA_GM_RUNTIME_ORIGIN:-https://amba-gm.unwhelm.online}"

BACKEND="${AMBA_GM_RUNTIME_BACKEND:-postgres}"
API_BASE="${AMBA_GM_API_BASE:-https://amba.unwhelm.online/api/v1}"

if [ "$BACKEND" = "postgres" ]; then
cat >"$GM_ENV" <<EOF
# Amba-GM server (Node 22.13+). Do not commit.
PORT=3010
AMBA_GM_RUNTIME_BACKEND=postgres
AMBA_GM_RUNTIME_ORIGIN=$ORIGIN
AMBA_GM_API_BASE=$API_BASE
EOF
else
mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"
SECRET="$(grep '^AMBA_GM_RUNTIME_SECRET=' "$AMBA_ENV" | cut -d= -f2-)"
test -n "$SECRET"
cat >"$GM_ENV" <<EOF
# Amba-GM server (Node 22.13+). Do not commit.
PORT=3010
AMBA_GM_RUNTIME_SECRET=$SECRET
AMBA_GM_RUNTIME_ORIGIN=$ORIGIN
AMBA_GM_DATA_DIR=$DATA_DIR
EOF
fi
chmod 600 "$GM_ENV"
echo "Updated $GM_ENV (secret redacted):"
grep -v SECRET "$GM_ENV"