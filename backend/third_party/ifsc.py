"""IFSC lookup via Razorpay's public IFSC directory.

https://ifsc.razorpay.com/<IFSC> is a free, unauthenticated endpoint that
returns the bank/branch behind an IFSC code. We use it for two things:

  1. Proving the IFSC actually exists (a well-formed but fake code fails here).
  2. Filling in the bank name ourselves instead of trusting what the host typed.

The lookup is best-effort: if Razorpay is slow or down we fall back to the
host-supplied bank name rather than blocking them from adding a payout account.
"""

import logging

import requests

logger = logging.getLogger(__name__)

IFSC_URL = "https://ifsc.razorpay.com/{code}"
_TIMEOUT = 5


def lookup_ifsc(code: str) -> dict | None:
    """
    Resolve an IFSC code to its bank/branch.

    Returns a dict on success, None when the code is unknown (HTTP 404).
    Raises IFSCUnavailable if the directory itself could not be reached, so the
    caller can tell "this IFSC is wrong" apart from "we couldn't check".
    """
    code = (code or "").strip().upper()
    if not code:
        return None
    try:
        resp = requests.get(IFSC_URL.format(code=code), timeout=_TIMEOUT)
    except Exception:
        logger.warning("IFSC lookup unreachable for %s", code)
        raise IFSCUnavailable

    if resp.status_code == 404:
        return None
    if resp.status_code != 200:
        logger.warning("IFSC lookup failed (%s) for %s", resp.status_code, code)
        raise IFSCUnavailable

    try:
        d = resp.json()
    except Exception:
        raise IFSCUnavailable

    return {
        "bank": d.get("BANK") or "",
        "branch": d.get("BRANCH") or "",
        "city": d.get("CITY") or "",
        "state": d.get("STATE") or "",
        "ifsc": d.get("IFSC") or code,
        # Razorpay reports which rails the branch supports.
        "upi": bool(d.get("UPI")),
        "imps": bool(d.get("IMPS")),
        "neft": bool(d.get("NEFT")),
    }


class IFSCUnavailable(Exception):
    """The IFSC directory could not be reached — validation is inconclusive."""
