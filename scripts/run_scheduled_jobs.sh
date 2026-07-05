#!/usr/bin/env bash
#
# Runs RoomBuddy's periodic booking jobs. Invoked by the systemd timer
# `roombuddy-cron.timer` every 5 minutes. Both commands are idempotent and
# cheap, so running them on the same cadence is safe:
#
#   expire_stale_bookings      — free up unpaid / unresponded bookings
#   advance_booking_lifecycle  — accepted → active on check-in,
#                                active/accepted → completed after check-out
#
# Each command is isolated so one failing does not stop the other.
set -uo pipefail

BACKEND="/home/ubuntu/roombuddy/backend"
VENV="$BACKEND/venv"
ENV_FILE="/etc/roombuddy/env"

cd "$BACKEND"

# Load env for manual runs; the systemd unit also sets EnvironmentFile.
if [ -f "$ENV_FILE" ]; then
    set -a && source "$ENV_FILE" && set +a
fi

"$VENV/bin/python" manage.py expire_stale_bookings     || echo "[cron] expire_stale_bookings failed"
"$VENV/bin/python" manage.py advance_booking_lifecycle || echo "[cron] advance_booking_lifecycle failed"
