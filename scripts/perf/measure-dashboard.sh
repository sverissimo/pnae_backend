#!/usr/bin/env bash
# Measure /relatorios/dashboard latency. KISS baseline tool for the
# Phases 1+2 caching work — run before merging, run after, compare in the log.
#
# Usage:
#   ./scripts/perf/measure-dashboard.sh <env> [label]
#   # examples:
#   ./scripts/perf/measure-dashboard.sh hmg before-phase1
#   ./scripts/perf/measure-dashboard.sh prod baseline
#
# Config is read from scripts/perf/.dashboard-perf.env (gitignored via *.env).
# Vars are env-suffixed (UPPERCASE) so one file covers dev/hmg/prod:
#
#   DASHBOARD_URL_HMG=https://hmg.example.com/relatorios/dashboard
#   DASHBOARD_AUTH_COOKIE_HMG="auth_token=eyJ..."     # web JWT, from DevTools
#   # — or, if your token comes via header —
#   DASHBOARD_AUTH_BEARER_HMG="eyJ..."
#
# Same shape for _DEV and _PROD. The script picks the right set based on
# the <env> arg (case-insensitive).
#
# Optional:
#   N=50 ./scripts/perf/measure-dashboard.sh hmg ...       # iterations (default 30)
#
# Output appends to scripts/perf/dashboard-perf.<env>.log (gitignored via *.log).

set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 <env> [label]" >&2
  exit 1
fi

ENV_RAW="$1"
ENV_LOWER="${ENV_RAW,,}"
ENV_UPPER="${ENV_RAW^^}"
LABEL="${2:-unlabelled}"
N="${N:-30}"

SCRIPT_DIR="$(dirname "$0")"
SIDECAR="$SCRIPT_DIR/.dashboard-perf.env"
OUT="$SCRIPT_DIR/dashboard-perf.$ENV_LOWER.log"

if [[ -f "$SIDECAR" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SIDECAR"
  set +a
fi

URL_VAR="DASHBOARD_URL_$ENV_UPPER"
COOKIE_VAR="DASHBOARD_AUTH_COOKIE_$ENV_UPPER"
BEARER_VAR="DASHBOARD_AUTH_BEARER_$ENV_UPPER"

DASHBOARD_URL="${!URL_VAR:-}"
COOKIE_VAL="${!COOKIE_VAR:-}"
BEARER_VAL="${!BEARER_VAR:-}"

if [[ -z "$DASHBOARD_URL" ]]; then
  echo "error: $URL_VAR not set (check $SIDECAR)" >&2
  exit 1
fi

AUTH_ARGS=()
if [[ -n "$COOKIE_VAL" ]]; then
  AUTH_ARGS=(-H "Cookie: $COOKIE_VAL")
elif [[ -n "$BEARER_VAL" ]]; then
  AUTH_ARGS=(-H "Authorization: Bearer $BEARER_VAL")
else
  echo "error: set $COOKIE_VAR or $BEARER_VAR (check $SIDECAR)" >&2
  exit 1
fi

TS="$(date '+%Y-%m-%d %H:%M:%S %z')"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo "running $N requests against [$ENV_LOWER] $DASHBOARD_URL ..."
for i in $(seq 1 "$N"); do
  curl -o /dev/null -sS -w "%{time_total} %{http_code}\n" \
    "${AUTH_ARGS[@]}" \
    "$DASHBOARD_URL" >> "$TMP"
done

BAD="$(awk '$2 !~ /^2/ { c++ } END { print c+0 }' "$TMP")"
SORTED="$(awk '{print $1}' "$TMP" | sort -n)"

STATS="$(echo "$SORTED" | awk '
  { a[NR] = $1; sum += $1 }
  END {
    n = NR
    if (n == 0) { print "no samples"; exit }
    printf "  n     %d\n", n
    printf "  min   %.3fs\n", a[1]
    printf "  p50   %.3fs\n", a[int(n*0.50 + 0.5)]
    printf "  p95   %.3fs\n", a[int(n*0.95 + 0.5)]
    printf "  max   %.3fs\n", a[n]
    printf "  mean  %.3fs\n", sum/n
  }
')"

{
  echo "==== $TS  env=$ENV_LOWER  label=$LABEL  N=$N ===="
  echo "url: $DASHBOARD_URL"
  if [[ "$BAD" != "0" ]]; then echo "WARN: $BAD non-2xx responses"; fi
  echo "$STATS"
  echo "raw (sorted):"
  echo "$SORTED" | awk '{printf "  %s\n", $0}'
  echo
} | tee -a "$OUT"

echo "appended to $OUT"
