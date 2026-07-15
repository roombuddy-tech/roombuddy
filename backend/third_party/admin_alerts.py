"""Lightweight admin alerts to the founder via a Telegram bot.

Telegram's official Bot API — reliable, free, and fine for internal ops pings
(approve an Aadhaar, a new booking came in). Unlike an unofficial relay, this
runs on Telegram's own infrastructure.

Setup (one time):
  1. In Telegram, create a bot via @BotFather → it gives you a bot token.
  2. Open your bot and press Start (or send it any message) so it may reply.
  3. Set env vars on the server:
        TELEGRAM_BOT_TOKEN=<token from BotFather>
        TELEGRAM_CHAT_ID=<your numeric chat id>
     (Fetch the chat id from https://api.telegram.org/bot<token>/getUpdates
      after messaging the bot — it's the `chat.id` in the response.)

Sends run in a background thread so a slow/failed alert never blocks or breaks
the user request that triggered it.
"""

import logging
import os
import threading

import requests

logger = logging.getLogger(__name__)


def _send(token: str, chat_id: str, message: str) -> None:
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": message,
                "disable_web_page_preview": True,
            },
            timeout=15,
        )
        if resp.status_code == 200 and resp.json().get("ok"):
            logger.info("Admin Telegram alert sent")
        else:
            logger.warning("Telegram alert failed (%s): %s", resp.status_code, resp.text[:200])
    except Exception:
        logger.exception("Telegram alert error")


def notify_admin(message: str) -> None:
    """Fire-and-forget Telegram alert to the admin. Never raises."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        logger.info("Admin alert not configured; skipping: %s", message[:80])
        return
    try:
        threading.Thread(
            target=_send, args=(token, chat_id, message), daemon=True,
        ).start()
    except Exception:
        logger.exception("Failed to start admin alert thread")
