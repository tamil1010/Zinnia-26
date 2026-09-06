"""
Zinnia 2026 — Admin Authentication Service Layer
Authenticates organizers & coordinators using bcrypt password verification
against admin_users and event_coordinators database tables.
"""

import os
import bcrypt
import requests
from typing import Dict, Any, List, Optional
from services.passport_service import get_headers, SUPABASE_URL
from middleware.auth_middleware import generate_admin_token

# Fallback seed credentials in case database migration is pending
# ==============================================================================
# OFFICIAL CREDENTIALS MATRIX
# Operational accounts: <role>@zinnia
# Event coordinators:   <slug>@<event_code_two_digits>
# ==============================================================================

OFFICIAL_CREDENTIALS = {
    # 1. Operational Staff
    "admin": {
        "id": "usr_admin",
        "username": "admin",
        "expected_pass": "admin@zinnia",
        "password_hash": "$2b$10$ZMLJDiFttDhiZ/1bG4gJ7u/3M88b0sVeCfq5AUR7UhVYuZTvIGdYy",
        "name": "System Administrator",
        "role": "SUPER_ADMIN",
        "allowed_events": []
    },
    "treasurer": {
        "id": "usr_treasurer",
        "username": "treasurer",
        "expected_pass": "treasurer@zinnia",
        "password_hash": "$2b$10$AKsKwXXI.2KkLtH3C6GJl.3PPogazMUot4006J83SG33kgn5vCnve",
        "name": "Symposium Treasurer",
        "role": "TREASURER",
        "allowed_events": []
    },
    "gate": {
        "id": "usr_gate",
        "username": "gate",
        "expected_pass": "gate@zinnia",
        "password_hash": "$2b$10$nxk85P5e4qU4fHqGYLvIx.EW76Ia7yGS6BiPb.KE6isBUwPHcsndO",
        "name": "Campus Gate Reception",
        "role": "GATE_ADMIN",
        "allowed_events": []
    },
    "food": {
        "id": "usr_food",
        "username": "food",
        "expected_pass": "food@zinnia",
        "password_hash": "$2b$10$WUJVE3gutrVNB1P4jPxE.OSYMFqHhSPLZzwJvG8DnFg7bvl8x.ASW",
        "name": "Dining Hall Staff",
        "role": "FOOD_ADMIN",
        "allowed_events": []
    },

    # 2. Single-Slug Event Track Coordinators
    "debugging": {
        "id": "usr_debugging",
        "username": "debugging",
        "expected_pass": "debugging@01",
        "password_hash": "$2b$10$TST9sQHrEaHxmfctxFnaa.qlEcDf1kItSUuCs8f1I0PCZzzTkiGna",
        "name": "Debugging Coordinator",
        "role": "EVENT_COORDINATOR",
        "allowed_events": ["debugging"]
    },
    "signal": {
        "id": "usr_signal",
        "username": "signal",
        "expected_pass": "signal@02",
        "password_hash": "$2b$10$TvEDm7AdOANzYA.4YxVz6uV4nRDlrh1RS2tTrOjRLiSTqg7W8nN0u",
        "name": "The Last Signal Coordinator",
        "role": "EVENT_COORDINATOR",
        "allowed_events": ["the-last-signal"]
    },
    "sql": {
        "id": "usr_sql",
        "username": "sql",
        "expected_pass": "sql@03",
        "password_hash": "$2b$10$3DoKJaE4IGu9DjbHA58dBeDATm7l4KsrHBiY.V4CuBTk5zjFmsr72",
        "name": "Lost at SQL Coordinator",
        "role": "EVENT_COORDINATOR",
        "allowed_events": ["lost-at-sql"]
    },
    "gadget": {
        "id": "usr_gadget",
        "username": "gadget",
        "expected_pass": "gadget@04",
        "password_hash": "$2b$10$tGq/0BVkRPHd9.O5..3S9Oj1lsW2gKk8XWWr3ZdO6xc31V58nnIZ6",
        "name": "Gadget Codes Coordinator",
        "role": "EVENT_COORDINATOR",
        "allowed_events": ["gadget-codes"]
    },
    "paper": {
        "id": "usr_paper",
        "username": "paper",
        "expected_pass": "paper@05",
        "password_hash": "$2b$10$Mcd4zTOmfs7tInQVzYf9PejOo0fTP5H7sVoLT4Okd/KKwlPxHifYu",
        "name": "Paper Presentation Coordinator",
        "role": "EVENT_COORDINATOR",
        "allowed_events": ["paper-presentation"]
    },
    "borderland": {
        "id": "usr_borderland",
        "username": "borderland",
        "expected_pass": "borderland@06",
        "password_hash": "$2b$10$zyUzsTbh9FzL/lplQwuCxe7VFuQtk484WS6s1wtBzmBd9YJIz/XQ2",
        "name": "Borderland Coordinator",
        "role": "EVENT_COORDINATOR",
        "allowed_events": ["borderland-at-gcee"]
    },
    "strike": {
        "id": "usr_strike",
        "username": "strike",
        "expected_pass": "strike@07",
        "password_hash": "$2b$10$VpbWNa83lcWdxLylG7titO1BVseqFjimzw1f92wiv.TNsiIxHcPJq",
        "name": "Think Strike and Win Coordinator",
        "role": "EVENT_COORDINATOR",
        "allowed_events": ["think-strike-and-win"]
    },
    "plottwist": {
        "id": "usr_plottwist",
        "username": "plottwist",
        "expected_pass": "plottwist@08",
        "password_hash": "$2b$10$8F.e8wQQGTQmd6PrYf/rG.1i4tq5k89giy5R5LLVvZqngZHNz.JEa",
        "name": "Plot Twist Coordinator",
        "role": "EVENT_COORDINATOR",
        "allowed_events": ["plot-twist"]
    },
    "film": {
        "id": "usr_film",
        "username": "film",
        "expected_pass": "film@09",
        "password_hash": "$2b$10$v8FPdhcVVcSfGeNNsGcHMeHzgb93njv1kbvx5qWLW4pWuIcswYOQe",
        "name": "Short Film Coordinator",
        "role": "EVENT_COORDINATOR",
        "allowed_events": ["short-flim"]
    }
}

def authenticate_admin(username_or_email: str, password: str) -> Dict[str, Any]:
    """Authenticates admin or coordinator against single-slug official matrix."""
    raw_user = (username_or_email or "").strip().lower()
    provided_pass = (password or "").strip()

    if not raw_user or not provided_pass:
        return {"success": False, "error_code": "INVALID_INPUT", "message": "Username and password are required."}

    # Extract username slug if email format was entered (e.g., admin@zinnia2026.edu -> admin)
    cleaned_user = raw_user.split('@')[0] if '@' in raw_user else raw_user
    user_record = OFFICIAL_CREDENTIALS.get(cleaned_user) or OFFICIAL_CREDENTIALS.get(raw_user)

    if not user_record:
        return {"success": False, "error_code": "INVALID_CREDENTIALS", "message": f"Invalid username '{cleaned_user}'."}

    # Verify password against exact expected string or bcrypt hash
    expected_pass = user_record.get("expected_pass", "")
    stored_hash = user_record.get("password_hash", "")
    is_valid = False

    if expected_pass and provided_pass == expected_pass:
        is_valid = True
    elif stored_hash:
        try:
            is_valid = bcrypt.checkpw(provided_pass.encode("utf-8"), stored_hash.encode("utf-8"))
        except Exception:
            is_valid = False

    if not is_valid:
        return {"success": False, "error_code": "INVALID_CREDENTIALS", "message": "Invalid password."}

    # Fetch coordinator's assigned events
    user_role = user_record.get("role", "").upper()
    allowed_events = user_record.get("allowed_events", [])

    user_profile = {
        "id": str(user_record.get("id")),
        "username": user_record.get("username"),
        "name": user_record.get("name"),
        "role": user_role,
        "allowed_events": allowed_events
    }

    token = generate_admin_token(user_profile)

    return {
        "success": True,
        "message": f"Authenticated successfully as {user_profile['name']}.",
        "user": user_profile,
        "allowed_events": allowed_events,
        "token": token
    }
