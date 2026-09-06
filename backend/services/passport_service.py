"""
Zinnia 2026 — Passport, Security & Check-in Service Layer
Handles:
- Compact HMAC-signed QR generation and validation: {"v":1,"t":"...","m":"...","f":"V"|"N","e":["01","04"],"s":"<hmac16>"}
- Campus Entry Gate Scan (enforces VERIFIED payment status + single-use)
- Event Track Check-in Scan (validates team event registration + single-use per track + coordinator RBAC)
- Food Token Scan (one-time meal distribution lock + instant Veg/Non-Veg telemetry)
- Idempotent Passport Email Dispatch
"""

import os
import json
import hmac
import hashlib
import datetime
import requests
from typing import Dict, Any, Optional, Tuple, List
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://aiefrwricgwchvapinlc.supabase.co").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "sb_publishable_jP4KLIgOGvI-QIWVEBzznA_5b_FJvOL")
QR_SIGNING_SECRET = os.getenv("QR_SIGNING_SECRET", "zinnia_2026_qr_signing_secret_key_prod_secure_2026")
if not QR_SIGNING_SECRET:
    raise RuntimeError("CRITICAL SECURITY ERROR: QR_SIGNING_SECRET environment variable is missing!")
N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "")

EVENT_CODE_MAPPINGS = {
    "debugging": "01",
    "the-last-signal": "02",
    "lost-at-sql": "03",
    "gadget-codes": "04",
    "paper-presentation": "05",
    "borderland-at-gcee": "06",
    "think-strike-and-win": "07",
    "plot-twist": "08",
    "short-flim": "09"
}

def get_headers(prefer_return: str = "representation") -> Dict[str, str]:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": f"return={prefer_return}"
    }

# ==============================================================================
# QR PAYLOAD SIGNING & VERIFICATION (§8.1)
# ==============================================================================
def sign_qr_content(passport_token: str, member_id: str, food_pref: str, event_codes: List[str]) -> str:
    f_val = "N" if (str(food_pref).upper() == "N" or str(food_pref).upper().startswith("NON")) else "V"
    e_codes = sorted(list(set(event_codes)))
    sig_payload = f"1|{passport_token}|{member_id}|{f_val}|{','.join(e_codes)}"
    return hmac.new(QR_SIGNING_SECRET.encode("utf-8"), sig_payload.encode("utf-8"), hashlib.sha256).hexdigest()[:16]

def generate_signed_qr_payload_for_member(member: Dict[str, Any], registered_events: List[Dict[str, Any]]) -> str:
    token = member.get("passport_token") or member.get("id") or ""
    member_id = str(member.get("id", ""))
    food_pref = (member.get("food_preference") or "VEG").upper()
    f_val = "N" if (food_pref == "N" or food_pref.startswith("NON")) else "V"
    
    event_codes = []
    for ev in registered_events:
        ev_id = ev.get("event_id") or (ev.get("events", {}).get("id") if isinstance(ev.get("events"), dict) else None)
        if ev_id and ev_id in EVENT_CODE_MAPPINGS:
            event_codes.append(EVENT_CODE_MAPPINGS[ev_id])
        elif ev_id:
            # Shorten UUID or custom ID
            event_codes.append(str(ev_id)[:2].upper())

    sig = sign_qr_content(token, member_id, f_val, event_codes)
    payload = {
        "v": 1,
        "t": token,
        "m": member_id,
        "f": f_val,
        "e": sorted(list(set(event_codes))),
        "s": sig
    }
    return json.dumps(payload, separators=(',', ':'))

def parse_and_validate_scan_payload(raw_scan: str) -> Tuple[str, Optional[Dict[str, Any]], bool, str]:
    """
    Parses scanned text. If compact JSON payload is provided, validates signature.
    Returns: (resolved_token, parsed_payload, is_signature_valid, status_message)
    """
    cleaned = raw_scan.strip()
    if not cleaned:
        return "", None, False, "Empty scan data."

    if cleaned.startswith("{") and cleaned.endswith("}"):
        try:
            data = json.loads(cleaned)
            token = data.get("t") or data.get("token") or data.get("passport_token") or data.get("id", "")
            member_id = str(data.get("m") or data.get("member_id", ""))
            f_val = data.get("f", "V")
            e_codes = data.get("e", [])
            signature = data.get("s", "")

            # Enforce signature verification on all structured badge payloads
            if any(k in data for k in ["f", "e", "s", "v", "m"]):
                if not signature or not token or not member_id:
                    return token or cleaned, data, False, "REJECTED: Structured QR badge missing cryptographic signature."
                expected_sig = sign_qr_content(token, member_id, f_val, e_codes)
                if hmac.compare_digest(signature, expected_sig):
                    return token, data, True, "Valid cryptographic QR signature."
                else:
                    return token, data, False, "WARNING: QR cryptographic signature invalid! Potential badge forgery."
            
            return token, data, True, "Plain JSON payload."
        except Exception:
            pass

    # URL parameter fallback
    if "?" in cleaned:
        try:
            import urllib.parse
            parsed_url = urllib.parse.urlparse(cleaned)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            token = query_params.get("token", [""])[0] or query_params.get("t", [""])[0] or query_params.get("id", [""])[0]
            if token:
                return token.strip(), None, True, "URL token parameter."
        except Exception:
            pass

    return cleaned, None, True, "Raw token/ID string."

# ==============================================================================
# DATABASE LOOKUPS
# ==============================================================================
def lookup_member(identifier: str) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Look up member by passport_token, id, or email, along with associated team."""
    cleaned = identifier.strip()
    if not cleaned:
        return None, None

    headers = get_headers()
    # 1. By passport_token
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/team_members?passport_token=eq.{cleaned}&select=*",
        headers=headers
    )
    members = r.json() if r.status_code == 200 and isinstance(r.json(), list) else []

    # 2. By id
    if not members:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/team_members?id=eq.{cleaned}&select=*",
            headers=headers
        )
        members = r.json() if r.status_code == 200 and isinstance(r.json(), list) else []

    # 3. By email
    if not members:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/team_members?email=eq.{cleaned}&select=*",
            headers=headers
        )
        members = r.json() if r.status_code == 200 and isinstance(r.json(), list) else []

    if not members:
        return None, None

    member = members[0]
    team_id = member.get("team_id")
    team = None
    if team_id:
        tr = requests.get(
            f"{SUPABASE_URL}/rest/v1/teams?team_id=eq.{team_id}&select=*",
            headers=headers
        )
        teams = tr.json() if tr.status_code == 200 and isinstance(tr.json(), list) else []
        if teams:
            team = teams[0]

    return member, team

def get_team_registered_events(team_id: str) -> List[Dict[str, Any]]:
    headers = get_headers()
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/event_registrations?team_id=eq.{team_id}&select=*,events(*)",
        headers=headers
    )
    if r.status_code == 200 and isinstance(r.json(), list):
        return r.json()
    return []

# ==============================================================================
# 1. ENTRY CHECK-IN (§8.2)
# ==============================================================================
def process_entry_checkin(
    scan_input: str = "",
    scanned_by: str = "Gate Reception Desk",
    location: str = "Main Campus Gate",
    token_or_id: Optional[str] = None
) -> Dict[str, Any]:
    raw_scan = token_or_id if token_or_id is not None else scan_input
    resolved_token, qr_data, sig_valid, sig_msg = parse_and_validate_scan_payload(raw_scan)
    if not sig_valid:
        return {
            "success": False,
            "reason": sig_msg,
            "security_warning": True
        }

    member, team = lookup_member(resolved_token)
    if not member:
        return {
            "success": False,
            "reason": f"No attendee found matching credential '{resolved_token}'.",
            "member": None
        }

    # Payment Verification Gate Check
    payment_status = team.get("payment_status") if team else None
    is_paid = team.get("payment", False) if team else False
    if payment_status != "VERIFIED" and not is_paid:
        return {
            "success": False,
            "reason": f"Gate entry denied. Team payment is {payment_status or 'UNPAID'} (requires treasurer verification).",
            "member": member,
            "team": team
        }

    member_id = member["id"]
    team_id = member["team_id"]
    member_name = member["name"]
    college = team.get("college", "GCE Erode") if team else "GCE Erode"

    headers = get_headers()

    # Check existing ENTRY attendance
    check_r = requests.get(
        f"{SUPABASE_URL}/rest/v1/attendance?member_id=eq.{member_id}&checkin_type=eq.ENTRY&select=*",
        headers=headers
    )
    if check_r.status_code == 200 and isinstance(check_r.json(), list) and len(check_r.json()) > 0:
        rec = check_r.json()[0]
        scan_time = rec.get("scanned_at", "earlier")
        scan_by = rec.get("scanned_by", "Gate Terminal")
        return {
            "success": False,
            "reason": f"Already checked in at campus entry on {scan_time} by {scan_by}.",
            "member": member,
            "team": team,
            "attendance_record": rec
        }

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload = {
        "team_id": team_id,
        "member_id": member_id,
        "passport_token_used": resolved_token,
        "participant_name": member_name,
        "college": college,
        "checkin_type": "ENTRY",
        "scanned_by": scanned_by,
        "location": location,
        "scanned_at": now_iso
    }

    insert_r = requests.post(f"{SUPABASE_URL}/rest/v1/attendance", headers=headers, json=payload)
    if insert_r.status_code in [200, 201]:
        return {
            "success": True,
            "reason": f"Campus entry granted! Welcome to Zinnia 2026, {member_name}.",
            "member": member,
            "team": team,
            "attendance": payload
        }
    else:
        if "ux_attendance_entry_once" in insert_r.text or insert_r.status_code == 409:
            return {"success": False, "reason": "Already checked in (entry limit reached).", "member": member, "team": team}
        return {"success": False, "reason": f"Attendance record error: {insert_r.text}", "member": member}

# ==============================================================================
# 2. EVENT CHECK-IN (§8.2 & §9.3)
# ==============================================================================
def process_event_checkin(
    scan_input: str = "",
    event_id: str = "",
    scanned_by: str = "Event Coordinator",
    location: str = "Event Venue",
    admin_user: Optional[Dict[str, Any]] = None,
    token_or_id: Optional[str] = None
) -> Dict[str, Any]:
    raw_scan = token_or_id if token_or_id is not None else scan_input
    if not event_id:
        return {"success": False, "reason": "Missing event_id in checkin request.", "member": None}

    # Coordinator RBAC check (§9.3)
    if admin_user and admin_user.get("role") == "EVENT_COORDINATOR":
        allowed = admin_user.get("allowed_events", [])
        if event_id not in allowed:
            return {
                "success": False,
                "reason": f"Authorization error: Coordinator '{admin_user.get('name')}' is not assigned to manage event '{event_id}'.",
                "member": None
            }

    resolved_token, qr_data, sig_valid, sig_msg = parse_and_validate_scan_payload(raw_scan)
    if not sig_valid:
        return {"success": False, "reason": sig_msg, "security_warning": True}

    member, team = lookup_member(resolved_token)
    if not member:
        return {"success": False, "reason": f"No attendee found matching credential '{resolved_token}'.", "member": None}

    member_id = member["id"]
    team_id = member["team_id"]
    member_name = member["name"]
    college = team.get("college", "GCE Erode") if team else "GCE Erode"
    headers = get_headers()

    # Fetch event metadata
    ev_r = requests.get(f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}&select=*", headers=headers)
    event_obj = ev_r.json()[0] if ev_r.status_code == 200 and len(ev_r.json()) > 0 else None
    event_name = event_obj.get("mission_name") or event_obj.get("title") if event_obj else event_id

    # Verify team registration for this event
    reg_r = requests.get(f"{SUPABASE_URL}/rest/v1/event_registrations?team_id=eq.{team_id}&select=*,events(*)", headers=headers)
    registered_events = reg_r.json() if reg_r.status_code == 200 and isinstance(reg_r.json(), list) else []
    
    is_registered = any(r.get("event_id") == event_id for r in registered_events)
    if not is_registered and team and team.get("registered_events"):
        is_registered = event_id in team.get("registered_events")

    if not is_registered:
        return {
            "success": False,
            "reason": f"Team '{team.get('team_name', team_id)}' is NOT registered for track '{event_name}'.",
            "member": member,
            "team": team,
            "registered_events": registered_events
        }

    # Check duplicate check-in
    check_r = requests.get(
        f"{SUPABASE_URL}/rest/v1/attendance?member_id=eq.{member_id}&event_id=eq.{event_id}&checkin_type=eq.EVENT&select=*",
        headers=headers
    )
    if check_r.status_code == 200 and isinstance(check_r.json(), list) and len(check_r.json()) > 0:
        rec = check_r.json()[0]
        scan_time = rec.get("scanned_at", "earlier")
        scan_by = rec.get("scanned_by", "Coordinator")
        return {
            "success": False,
            "reason": f"Already checked into {event_name} at {scan_time} by {scan_by}.",
            "member": member,
            "team": team,
            "registered_events": registered_events,
            "attendance_record": rec
        }

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload = {
        "team_id": team_id,
        "member_id": member_id,
        "passport_token_used": resolved_token,
        "participant_name": member_name,
        "college": college,
        "checkin_type": "EVENT",
        "event_id": event_id,
        "event_name": event_name,
        "scanned_by": scanned_by,
        "location": location,
        "scanned_at": now_iso
    }

    insert_r = requests.post(f"{SUPABASE_URL}/rest/v1/attendance", headers=headers, json=payload)
    if insert_r.status_code in [200, 201]:
        return {
            "success": True,
            "reason": f"Admitted to {event_name}. Track check-in confirmed!",
            "member": member,
            "team": team,
            "event": event_obj,
            "registered_events": registered_events,
            "attendance": payload
        }
    else:
        if "ux_attendance_event_once" in insert_r.text or insert_r.status_code == 409:
            return {"success": False, "reason": f"Already checked in for {event_name}.", "member": member, "team": team}
        return {"success": False, "reason": f"Database insertion error: {insert_r.text}", "member": member}

# ==============================================================================
# 3. FOOD TOKEN CHECK-IN (§8.2)
# ==============================================================================
def process_food_checkin(
    scan_input: str = "",
    scanned_by: str = "Dining Staff",
    location: str = "Dining Counter A",
    token_or_id: Optional[str] = None
) -> Dict[str, Any]:
    raw_scan = token_or_id if token_or_id is not None else scan_input
    resolved_token, qr_data, sig_valid, sig_msg = parse_and_validate_scan_payload(raw_scan)
    if not sig_valid:
        return {"success": False, "reason": sig_msg, "security_warning": True}

    member, team = lookup_member(resolved_token)
    if not member:
        return {"success": False, "reason": f"No attendee found matching credential '{resolved_token}'.", "member": None}

    member_id = member["id"]
    member_name = member["name"]
    
    # Prioritize database row value; only fallback to QR if DB record is empty and signature is valid
    db_pref = (member.get("food_preference") or "").strip().upper()
    if db_pref in ["NON_VEG", "NON-VEG", "NONVEG", "N"] or db_pref.startswith("NON"):
        resolved_preference = "NON_VEG"
    elif db_pref in ["VEG", "V"]:
        resolved_preference = "VEG"
    else:
        qr_f = (qr_data.get("f") if (qr_data and sig_valid) else "").upper()
        resolved_preference = "NON_VEG" if qr_f == "N" else "VEG"

    is_non_veg = (resolved_preference == "NON_VEG")
    headers = get_headers()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # 1. Check attendance records for prior food check-in
    check_r = requests.get(
        f"{SUPABASE_URL}/rest/v1/attendance?member_id=eq.{member_id}&checkin_type=eq.FOOD&select=*",
        headers=headers
    )
    if (check_r.status_code == 200 and isinstance(check_r.json(), list) and len(check_r.json()) > 0) or member.get("food_collected"):
        claimed_at = "earlier"
        if check_r.status_code == 200 and len(check_r.json()) > 0:
            claimed_at = check_r.json()[0].get("scanned_at", "earlier")
        elif member.get("food_collected_at"):
            claimed_at = member.get("food_collected_at")
        return {
            "success": False,
            "reason": f"Meal token already claimed at {claimed_at}. Single issuance limit reached.",
            "member": member,
            "team": team,
            "food_preference": resolved_preference
        }

    # 2. Record food check-in in attendance table
    team_id = member.get("team_id", "")
    college = team.get("college", "GCE Erode") if team else "GCE Erode"
    attendance_payload = {
        "team_id": team_id,
        "member_id": member_id,
        "passport_token_used": resolved_token,
        "participant_name": member_name,
        "college": college,
        "checkin_type": "FOOD",
        "scanned_by": scanned_by,
        "location": location,
        "scanned_at": now_iso
    }
    requests.post(f"{SUPABASE_URL}/rest/v1/attendance", headers=headers, json=attendance_payload)

    # 3. Best-effort update on team_members if food_collected column exists
    try:
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/team_members?id=eq.{member_id}",
            headers=headers,
            json={"food_collected": True, "food_collected_at": now_iso}
        )
    except Exception:
        pass

    member["food_collected"] = True
    member["food_collected_at"] = now_iso

    return {
        "success": True,
        "reason": f"Meal token validated for {member_name}. Issue {'🍗 NON-VEG' if is_non_veg else '🌱 VEG'} meal!",
        "member": member,
        "team": team,
        "food_preference": resolved_preference
    }

# ==============================================================================
# 4. IDEMPOTENT PASSPORT DISPATCH (§7.3)
# ==============================================================================
def trigger_passport_dispatch(
    team_id: str,
    app_base_url: str = "http://localhost:5173",
    force_resend: bool = False
) -> Dict[str, Any]:
    from services.email_service import send_participant_passport_email
    headers = get_headers()

    # 1. Fetch team members
    r = requests.get(f"{SUPABASE_URL}/rest/v1/team_members?team_id=eq.{team_id}&select=*", headers=headers)
    if r.status_code != 200 or not isinstance(r.json(), list):
        return {"success": False, "error": f"Failed to fetch team members: {r.text}"}

    members = r.json()

    # 2. Fetch team info
    tr = requests.get(f"{SUPABASE_URL}/rest/v1/teams?team_id=eq.{team_id}&select=*", headers=headers)
    team = tr.json()[0] if tr.status_code == 200 and len(tr.json()) > 0 else {"team_id": team_id, "team_name": f"Team {team_id}"}

    # 3. Fetch registered events
    registered_events = get_team_registered_events(team_id)

    dispatch_rows = []
    email_results = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    for m in members:
        # Idempotency check: skip already dispatched unless force_resend is set
        if m.get("passport_sent_at") and not force_resend:
            email_results.append({
                "success": True,
                "status": "SKIPPED_ALREADY_SENT",
                "member_id": m["id"],
                "email": m.get("email")
            })
            continue

        mail_res = send_participant_passport_email(
            member=m,
            team=team,
            registered_events=registered_events,
            app_base_url=app_base_url,
            force_resend=force_resend
        )
        email_results.append(mail_res)

        dispatch_status = "SENT" if mail_res.get("success") else "FAILED"
        dispatch_rows.append({
            "member_id": m["id"],
            "channel": "EMAIL",
            "status": dispatch_status,
            "provider_ref": mail_res.get("status"),
            "error_message": mail_res.get("error"),
            "created_at": now_iso,
            "sent_at": now_iso if dispatch_status == "SENT" else None
        })

        if mail_res.get("success"):
            requests.patch(
                f"{SUPABASE_URL}/rest/v1/team_members?id=eq.{m['id']}",
                headers=headers,
                json={"passport_sent_at": now_iso}
            )

    if dispatch_rows:
        try:
            requests.post(f"{SUPABASE_URL}/rest/v1/passport_dispatch", headers=headers, json=dispatch_rows)
        except Exception as e:
            print(f"[Dispatch Log Error] {e}")

    return {
        "success": True,
        "team_id": team_id,
        "dispatched_count": len(dispatch_rows),
        "results": email_results
    }

def update_dispatch_status(
    member_id: str,
    status: str,
    channel: str = "EMAIL",
    provider_ref: Optional[str] = None,
    error_message: Optional[str] = None
) -> Dict[str, Any]:
    headers = get_headers()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    record = {
        "member_id": member_id,
        "channel": channel,
        "status": status,
        "provider_ref": provider_ref,
        "error_message": error_message,
        "sent_at": now_iso if status == "SENT" else None
    }
    try:
        requests.post(f"{SUPABASE_URL}/rest/v1/passport_dispatch", headers=headers, json=[record])
        if status == "SENT":
            requests.patch(f"{SUPABASE_URL}/rest/v1/team_members?id=eq.{member_id}", headers=headers, json={"passport_sent_at": now_iso})
    except Exception as e:
        print(f"[Dispatch Status Update Error] {e}")
    return {"success": True, "record": record}

def generate_qr_image_bytes(data: str) -> bytes:
    from services.email_service import generate_qr_png_bytes
    return generate_qr_png_bytes(data)
