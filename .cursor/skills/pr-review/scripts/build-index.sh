#!/usr/bin/env bash
# Regenerate .cursor/codebase-index.md — run from repo root.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OUT="$ROOT/.cursor/codebase-index.md"
cd "$ROOT"

list_classes() {
  local dir="$1" label="$2"
  [[ -d "$dir" ]] || return 0
  echo "### $label"
  echo '```'
  grep -rh '^class ' "$dir" --include='*.php' 2>/dev/null \
    | sed -E 's/^class ([A-Za-z0-9_]+).*/\1/' \
    | sort -u \
    | sed 's/^/- /' || true
  echo '```'
  echo
}

{
  echo "# Bus Codebase Index"
  echo
  echo "> Auto-generated. Run \`.cursor/skills/pr-review/scripts/build-index.sh\` to refresh."
  echo "> Last built: $(date -u '+%Y-%m-%d %H:%M UTC')"
  echo
  echo "## Quick paths"
  echo
  echo '| Area | Path |'
  echo '|------|------|'
  echo '| Routes | `app/routes.php` |'
  echo '| Global bootstrap | `app/start/global.php` |'
  echo '| Controllers (all) | `app/controllers/` |'
  echo '| Services (App\\) | `app/services/` |'
  echo '| Repositories | `app/repositories/` |'
  echo '| Models (global) | `app/models/` |'
  echo '| Booking engine | `app/busbookingengine/` |'
  echo '| Payment gateways | `app/busbookingengine/paymentgateway/` |'
  echo '| API providers | `app/libraries/providers/` |'
  echo '| Mailers | `app/libraries/mailers/` |'
  echo '| Artisan commands | `app/commands/` |'
  echo '| Views (Blade) | `app/views/` |'
  echo '| Config | `app/config/` |'
  echo '| Migrations | `app/database/migrations/` |'
  echo
  echo "## Controller directories"
  echo '```'
  find app/controllers -mindepth 1 -maxdepth 1 -type d | sed 's|app/controllers/||' | sort | sed 's/^/- /'
  echo '```'
  echo
  list_classes app/services "Services (App\\Services)"
  list_classes app/repositories "Repositories"
  list_classes app/models "Models"
  list_classes app/busbookingengine/bookingmodules "Booking modules"
  list_classes app/busbookingengine/paymentgateway "Payment gateways"
  list_classes app/contracts "Contracts"
  echo "## Key flows (grep anchors)"
  echo
  echo '| Flow | Start here |'
  echo '|------|------------|'
  echo '| Mobile app booking | `MobileAppBookingController`, `MobileBooking` |'
  echo '| Mobile app search | `MobileAppSearchController` |'
  echo '| WWW booking | `WWWBookingController`, `WWWBooking` |'
  echo '| Client API | `ClientAPIController`, `ClientApiService` |'
  echo '| API user / commission | `ApiUserService`, `ApiUserController` |'
  echo '| Operator payment | `OperatorPaymentController`, `OperatorPaymentModel` |'
  echo '| Shohoz commission | `ShohozCommissionService`, `ShohozCommissionController` |'
  echo '| Cancel / refund | `CancelTransactionService`, cancel controllers |'
  echo '| Third-party booking | `ThirdPartyBookingController`, `ThirdPartyBooking` |'
  echo '| Agent booking | `AgentBookingController`, `AgentBooking` |'
  echo '| CC booking | `CCBookingController`, `CCBooking` |'
  echo '| Discount / coupon | `ClientApiDiscountService`, `ShohozCoupon` |'
  echo '| Policy checks | `PolicyService`, `Policy` model |'
  echo
} > "$OUT"

echo "Wrote $OUT"
