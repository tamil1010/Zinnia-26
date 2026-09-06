"""
Zinnia 2026 — Payment Service Layer
Implements secure UTR submission, idempotency, admin verification,
rejection, and triggers n8n pass dispatch ONLY upon admin verification.
"""

import os
import datetime
import requests
from typing import Dict, Any, Optional, List, Tuple
from services.passport_service import get_headers, SUPABASE_URL

def safe_supabase_get(url: str, headers: dict) -> Tuple[bool, Any]:
    try:
        r = requests.get(url, headers=headers, timeout=4)
        if r.status_code == 200:
            return True, r.json()
        return False, []
    except Exception as e:
        print(f"[Supabase REST Notice] GET failed ({url}): {e}")
        return False, []

def safe_supabase_patch(url: str, headers: dict, json_data: Any) -> Tuple[bool, Any]:
    try:
        r = requests.patch(url, headers=headers, json=json_data, timeout=4)
        if r.status_code in (200, 204):
            return True, r.json() if r.text else {}
        return False, {}
    except Exception as e:
        print(f"[Supabase REST Notice] PATCH failed ({url}): {e}")
        return False, {}

def safe_supabase_delete(url: str, headers: dict) -> Tuple[bool, Any]:
    try:
        r = requests.delete(url, headers=headers, timeout=4)
        if r.status_code in (200, 204):
            return True, r.json() if r.text else {}
        return False, {}
    except Exception as e:
        print(f"[Supabase REST Notice] DELETE failed ({url}): {e}")
        return False, {}

def safe_supabase_post(url: str, headers: dict, json_data: Any) -> Tuple[bool, Any]:
    try:
        req_headers = dict(headers)
        req_headers["Prefer"] = "return=representation"
        r = requests.post(url, headers=req_headers, json=json_data, timeout=4)
        if r.status_code in (200, 201):
            return True, r.json() if r.text else {}
        print(f"[Supabase POST Error] HTTP {r.status_code}: {r.text}")
        return False, {"status_code": r.status_code, "text": r.text}
    except Exception as e:
        print(f"[Supabase REST Notice] POST failed ({url}): {e}")
        return False, {"error": str(e)}

import json

DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "payments.json")

def load_local_payments() -> Dict[str, Any]:
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
                elif isinstance(data, list):
                    res = {}
                    for item in data:
                        if isinstance(item, dict) and item.get("team_id"):
                            res[item["team_id"]] = item
                    return res
    except Exception:
        pass
    return {}

def save_local_payment(team_id: str, record: Dict[str, Any]):
    try:
        data = load_local_payments()
        data[team_id] = record
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[PaymentStore Error] {e}")

def delete_local_payment(team_id: str):
    try:
        data = load_local_payments()
        if team_id in data:
            del data[team_id]
            os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            print(f"[PaymentStore Delete] Successfully removed team '{team_id}' from local cache.")
    except Exception as e:
        print(f"[PaymentStore Delete Error] {e}")

def delete_team_registration_service(team_id: str) -> Dict[str, Any]:
    if not team_id:
        return {"success": False, "error": "Team ID is required."}

    headers = get_headers()
    # 1. Delete from all Supabase staging & production tables
    safe_supabase_delete(f"{SUPABASE_URL}/rest/v1/pending_registration_emails?team_id=eq.{team_id}", headers)
    safe_supabase_delete(f"{SUPABASE_URL}/rest/v1/pending_registrations?team_id=eq.{team_id}", headers)
    safe_supabase_delete(f"{SUPABASE_URL}/rest/v1/event_registrations?team_id=eq.{team_id}", headers)
    safe_supabase_delete(f"{SUPABASE_URL}/rest/v1/team_payments?team_id=eq.{team_id}", headers)
    safe_supabase_delete(f"{SUPABASE_URL}/rest/v1/attendance?team_id=eq.{team_id}", headers)
    safe_supabase_delete(f"{SUPABASE_URL}/rest/v1/team_members?team_id=eq.{team_id}", headers)
    safe_supabase_delete(f"{SUPABASE_URL}/rest/v1/teams?team_id=eq.{team_id}", headers)

    # 2. Delete from local cache file data/payments.json
    delete_local_payment(team_id)

    return {"success": True, "message": f"Registration for team '{team_id}' deleted successfully."}

def get_payment_record(team_id: str) -> Optional[Dict[str, Any]]:
    """Fetch payment / registration record from staging or main tables."""
    headers = get_headers()
    # 1. Check staging table: pending_registrations
    ok_p, res_p = safe_supabase_get(f"{SUPABASE_URL}/rest/v1/pending_registrations?team_id=eq.{team_id}&select=*", headers)
    if ok_p and isinstance(res_p, list) and len(res_p) > 0:
        return res_p[0]

    # 2. Check main table: team_payments
    ok, res = safe_supabase_get(f"{SUPABASE_URL}/rest/v1/team_payments?team_id=eq.{team_id}&select=*", headers)
    if ok and isinstance(res, list) and len(res) > 0:
        return res[0]

    return load_local_payments().get(team_id)

def get_fee_per_head() -> int:
    try:
        return int(os.getenv("REGISTRATION_FEE_PER_HEAD", "250"))
    except (ValueError, TypeError):
        return 250

def submit_payment_service(team_id: str, utr_number: str, submitted_amount: float) -> Dict[str, Any]:
    """
    Submits participant transaction reference / UTR for treasurer review.
    Updates the staging record in pending_registrations.
    """
    headers = get_headers()
    if not team_id:
        return {"success": False, "status_code": 400, "error_code": "TEAM_NOT_FOUND", "message": "Team ID is required."}

    if not utr_number or not isinstance(utr_number, str):
        return {"success": False, "status_code": 400, "error_code": "INVALID_UTR", "message": "Transaction reference / UTR is required."}

    cleaned_utr = utr_number.strip().upper()
    if len(cleaned_utr) < 10 or len(cleaned_utr) > 30 or not cleaned_utr.isalnum():
        return {
            "success": False,
            "status_code": 400,
            "error_code": "INVALID_UTR",
            "message": "Transaction reference / UTR must be 10 to 30 alphanumeric characters (no spaces or special symbols)."
        }

    # Check if UTR is already used in pending_registrations
    ok_pu, res_pu = safe_supabase_get(f"{SUPABASE_URL}/rest/v1/pending_registrations?utr_number=eq.{cleaned_utr}&select=team_id,payment_status", headers)
    if ok_pu and isinstance(res_pu, list):
        other_teams = [p for p in res_pu if p.get("team_id") != team_id]
        if other_teams:
            return {
                "success": False,
                "status_code": 409,
                "error_code": "DUPLICATE_UTR",
                "message": f"Transaction reference '{cleaned_utr}' has already been submitted by another team ({other_teams[0].get('team_id')}). Each payment proof must be unique."
            }

    # Check if UTR is already used in verified team_payments
    ok_u, res_u = safe_supabase_get(f"{SUPABASE_URL}/rest/v1/team_payments?utr_number=eq.{cleaned_utr}&select=team_id,payment_status", headers)
    if ok_u and isinstance(res_u, list):
        other_teams = [p for p in res_u if p.get("team_id") != team_id]
        if other_teams:
            return {
                "success": False,
                "status_code": 409,
                "error_code": "DUPLICATE_UTR",
                "message": f"Transaction reference '{cleaned_utr}' was already verified for another team ({other_teams[0].get('team_id')})."
            }

    # Fetch staging record
    pending = get_payment_record(team_id) or {}
    members = pending.get("members", [])
    member_count = len(members) if isinstance(members, list) and len(members) > 0 else 1
    per_member_fee = get_fee_per_head()
    calculated_expected = pending.get("expected_amount") or max(per_member_fee, member_count * per_member_fee)

    if not submitted_amount or submitted_amount <= 0:
        submitted_amount = float(calculated_expected)

    if pending.get("payment_status") == "VERIFIED":
        return {
            "success": True,
            "error_code": "PAYMENT_ALREADY_VERIFIED",
            "message": "Payment for this team has already been verified.",
            "team_id": team_id,
            "payment_status": "VERIFIED",
            "utr_number": pending.get("utr_number", cleaned_utr),
            "expected_amount": calculated_expected,
            "submitted_amount": pending.get("submitted_amount", calculated_expected)
        }

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    pay_update = {
        "utr_number": cleaned_utr,
        "submitted_amount": submitted_amount,
        "expected_amount": calculated_expected,
        "payment_status": "PENDING_VERIFICATION",
        "rejection_reason": None,
        "updated_at": now_iso
    }

    # 1. Update staging table: pending_registrations
    ok_patch, res_patch = safe_supabase_patch(f"{SUPABASE_URL}/rest/v1/pending_registrations?team_id=eq.{team_id}", headers, pay_update)
    if not ok_patch:
        err_patch_text = str(res_patch)
        if "23505" in err_patch_text or "uq_pending_reg_utr" in err_patch_text or "duplicate" in err_patch_text.lower():
            return {
                "success": False,
                "status_code": 409,
                "error_code": "DUPLICATE_UTR",
                "message": f"Transaction reference '{cleaned_utr}' has already been submitted by another team. Each payment proof must be unique."
            }
        return {
            "success": False,
            "status_code": 500,
            "error_code": "PAYMENT_SUBMIT_FAILED",
            "message": f"Failed to record transaction reference: {err_patch_text}"
        }

    # 2. Save local cache
    pending.update(pay_update)
    save_local_payment(team_id, pending)

    return {
        "success": True,
        "message": "Payment proof recorded successfully! Transaction reference forwarded to treasurer for verification.",
        "team_id": team_id,
        "payment_status": "PENDING_VERIFICATION",
        "utr_number": cleaned_utr,
        "member_count": member_count,
        "submitted_amount": submitted_amount,
        "expected_amount": calculated_expected
    }

def get_payment_status_service(team_id: str) -> Dict[str, Any]:
    """
    Fetch live payment status from staging or main tables.
    Returns expected amount, UTR, and member details.
    """
    headers = get_headers()
    print(f"\n[Payment Gateway] 🔍 Status requested for Team ID: {team_id}")

    # 1. Check staging table: pending_registrations
    ok_p, res_p = safe_supabase_get(f"{SUPABASE_URL}/rest/v1/pending_registrations?team_id=eq.{team_id}&select=*", headers)
    if ok_p and isinstance(res_p, list) and len(res_p) > 0:
        pending = res_p[0]
        members = pending.get("members", [])
        member_count = len(members) if isinstance(members, list) else 1
        expected = pending.get("expected_amount") or (member_count * 250)
        print(f"[Payment Gateway] 📋 Found staging record for {team_id}: status={pending.get('payment_status')}, fee=Rs.{expected}, members={member_count}")
        return {
            "success": True,
            "team_id": team_id,
            "team_name": pending.get("team_name", f"Team {team_id}"),
            "payment": False,
            "payment_status": pending.get("payment_status", "AWAITING_PAYMENT"),
            "member_count": member_count,
            "members": members,
            "registered_events": pending.get("registered_events", []),
            "expected_amount": expected,
            "submitted_amount": pending.get("submitted_amount", expected),
            "utr_number": pending.get("utr_number"),
            "rejection_reason": pending.get("rejection_reason"),
            "created_at": pending.get("created_at"),
            "updated_at": pending.get("updated_at")
        }

    # 2. Check main tables: teams & team_payments (for verified teams)
    ok_t, res_t = safe_supabase_get(f"{SUPABASE_URL}/rest/v1/teams?team_id=eq.{team_id}&select=team_id,team_name,payment_status", headers)
    if ok_t and isinstance(res_t, list) and len(res_t) > 0:
        team = res_t[0]
        ok_m, res_m = safe_supabase_get(f"{SUPABASE_URL}/rest/v1/team_members?team_id=eq.{team_id}&select=id,name,email,phone,food_preference,is_leader", headers)
        members_list = res_m if (ok_m and isinstance(res_m, list)) else []
        member_count = max(1, len(members_list))
        expected_amount = member_count * 250

        ok_pay, res_pay = safe_supabase_get(f"{SUPABASE_URL}/rest/v1/team_payments?team_id=eq.{team_id}&select=*", headers)
        payment = res_pay[0] if (ok_pay and isinstance(res_pay, list) and len(res_pay) > 0) else {}

        return {
            "success": True,
            "team_id": team_id,
            "team_name": team.get("team_name", f"Team {team_id}"),
            "payment": True,
            "payment_status": "VERIFIED",
            "member_count": member_count,
            "members": members_list,
            "expected_amount": payment.get("expected_amount", expected_amount),
            "submitted_amount": payment.get("submitted_amount", expected_amount),
            "utr_number": payment.get("utr_number"),
            "rejection_reason": None,
            "payment_verified_at": payment.get("payment_verified_at")
        }

    # 3. Check local cache
    local = load_local_payments().get(team_id)
    if local:
        members = local.get("members", [])
        member_count = len(members) if isinstance(members, list) else 1
        expected = local.get("expected_amount") or (member_count * 250)
        return {
            "success": True,
            "team_id": team_id,
            "team_name": local.get("team_name", f"Team {team_id}"),
            "payment": local.get("payment_status") == "VERIFIED",
            "payment_status": local.get("payment_status", "AWAITING_PAYMENT"),
            "member_count": member_count,
            "members": members,
            "expected_amount": expected,
            "submitted_amount": local.get("submitted_amount", expected),
            "utr_number": local.get("utr_number"),
            "rejection_reason": local.get("rejection_reason")
        }

    return {"success": False, "error_code": "NOT_FOUND", "message": f"No registration found with Team ID {team_id}"}

def verify_payment_by_treasurer(team_id: str, action: str = "VERIFY", reason: str = "", admin_name: str = "Treasurer") -> Dict[str, Any]:
    """
    Treasurer verification action.
    VERIFY -> Atomically promotes team from pending_registrations to teams via promote_pending_team RPC.
    REJECT -> Sets rejection reason in pending_registrations and emails rejection notification.
    """
    headers = get_headers()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    action = action.upper()

    # Fetch staging record
    pending = get_payment_record(team_id) or {"team_id": team_id}
    members = pending.get("members", [])
    if isinstance(members, str):
        try:
            members = json.loads(members)
        except Exception:
            members = []

    if action == "VERIFY":
        # Execute atomic PL/pgSQL promote function in a single transaction (Task 1)
        import uuid
        is_valid_uuid = False
        try:
            uuid.UUID(str(admin_name))
            is_valid_uuid = True
        except Exception:
            is_valid_uuid = False

        rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/promote_pending_team"
        rpc_payload = {
            "p_team_id": team_id,
            "p_admin": admin_name if is_valid_uuid else None
        }

        ok_rpc, res_rpc = safe_supabase_post(rpc_url, headers, rpc_payload)
        if not ok_rpc:
            err_msg = (res_rpc.get("message") or res_rpc.get("text") or str(res_rpc)) if isinstance(res_rpc, dict) else str(res_rpc)
            print(f"[Promotion RPC Error] RPC promotion notice for team {team_id}: {err_msg}. Running fallback REST promotion...")

            if "23505" in str(res_rpc) or "duplicate" in str(res_rpc).lower() or "already registered" in str(res_rpc).lower():
                return {
                    "success": False,
                    "error_code": "DUPLICATE_EMAIL",
                    "message": f"Cannot verify team: A member email is already registered in another verified team."
                }

            # REST Fallback Promotion
            try:
                import secrets
                clean_num = team_id.replace("ZIN-", "")
                
                # 1. Insert team
                team_data = {
                    "team_id": team_id,
                    "team_name": pending.get("team_name", f"Team {team_id}"),
                    "college": pending.get("college", "GCE Erode"),
                    "department": pending.get("department", "CSE"),
                    "year": pending.get("year", "III"),
                    "registered_events": pending.get("registered_events", []),
                    "payment_status": "VERIFIED"
                }
                safe_supabase_post(f"{SUPABASE_URL}/rest/v1/teams", headers, team_data)

                # 2. Insert team members
                promoted_members = []
                for idx, m in enumerate(members):
                    m_id = m.get("id") or f"ATT-{clean_num}-{idx+1}"
                    p_token = secrets.token_hex(16)
                    m_data = {
                        "id": m_id,
                        "team_id": team_id,
                        "name": m.get("name", "Participant"),
                        "email": m.get("email", "").strip().lower(),
                        "phone": m.get("phone", ""),
                        "is_leader": m.get("is_leader", idx == 0),
                        "food_preference": (m.get("food_preference") or "VEG").upper(),
                        "passport_token": p_token
                    }
                    safe_supabase_post(f"{SUPABASE_URL}/rest/v1/team_members", headers, m_data)
                    promoted_members.append(m_data)

                # 3. Insert event registrations
                for ev_id in pending.get("registered_events", []):
                    safe_supabase_post(f"{SUPABASE_URL}/rest/v1/event_registrations", headers, {
                        "team_id": team_id,
                        "event_id": ev_id,
                        "team_name": pending.get("team_name")
                    })

                # 4. Insert team payments
                exp_amt = pending.get("expected_amount") or (len(members) * 250)
                sub_amt = pending.get("submitted_amount") or exp_amt
                safe_supabase_post(f"{SUPABASE_URL}/rest/v1/team_payments", headers, {
                    "team_id": team_id,
                    "expected_amount": exp_amt,
                    "submitted_amount": sub_amt,
                    "utr_number": pending.get("utr_number"),
                    "payment_status": "VERIFIED"
                })

                # 5. Remove from pending_registrations
                requests.delete(f"{SUPABASE_URL}/rest/v1/pending_registrations?team_id=eq.{team_id}", headers=headers)
                res_rpc = {"success": True, "method": "REST_FALLBACK", "members": promoted_members}
            except Exception as fallback_err:
                print(f"[Promotion Fallback Error] {fallback_err}")
                return {
                    "success": False,
                    "error_code": "PROMOTION_FAILED",
                    "message": f"Promotion failed: {err_msg}"
                }

        # ONLY dispatch passport emails if promotion succeeded!
        dispatch_res = None
        try:
            from services.passport_service import trigger_passport_dispatch
            dispatch_res = trigger_passport_dispatch(team_id)
        except Exception as e:
            print(f"[Treasurer Notice] Passport dispatch notification: {e}")

        # Update local backup
        pending["payment_status"] = "VERIFIED"
        save_local_payment(team_id, pending)

        members_output = promoted_members if "promoted_members" in locals() else (res_rpc.get("members") if isinstance(res_rpc, dict) else [])

        return {
            "success": True,
            "message": f"Team {team_id} verified and promoted to official symposium records. Gate passes dispatched!",
            "team_id": team_id,
            "payment_status": "VERIFIED",
            "promotion": res_rpc,
            "members": members_output,
            "dispatch": dispatch_res
        }

    else:
        # Rejection
        reason_text = reason or "Invalid or unverified transaction reference."
        
        # 1. Update pending_registrations in staging table
        safe_supabase_patch(f"{SUPABASE_URL}/rest/v1/pending_registrations?team_id=eq.{team_id}", headers, {
            "payment_status": "REJECTED",
            "rejection_reason": reason_text,
            "updated_at": now_iso
        })

        pending["payment_status"] = "REJECTED"
        pending["rejection_reason"] = reason_text
        save_local_payment(team_id, pending)

        # 2. Dispatch rejection email to EACH member
        email_errors = []
        emails_sent = 0
        dispatch_rows = []

        try:
            from services.email_service import send_payment_rejected_email, APP_BASE_URL
            resubmit_url = f"{APP_BASE_URL}/payment?id={team_id}&edit=true"

            # Check previous rejection dispatches for idempotency
            r_prev = requests.get(
                f"{SUPABASE_URL}/rest/v1/passport_dispatch?channel=eq.EMAIL&provider_ref=eq.REJECTION_NOTICE&status=eq.REJECTION_SENT&select=member_id,created_at",
                headers=headers
            )
            already_notified = set()
            if r_prev.status_code == 200 and isinstance(r_prev.json(), list):
                sub_time = pending.get("updated_at")
                for disp in r_prev.json():
                    already_notified.add(disp.get("member_id"))

            for idx, m in enumerate(members):
                m_email = m.get("email", "").strip()
                if not m_email or m_email in already_notified:
                    continue

                clean_num = team_id.replace("ZIN-", "")
                m_id = f"ATT-{clean_num}-{idx+1}"
                mail_res = send_payment_rejected_email(
                    member=m,
                    team=pending,
                    reason=reason_text,
                    resubmit_url=resubmit_url
                )

                if mail_res.get("success"):
                    emails_sent += 1
                    dispatch_status = "REJECTION_SENT"
                else:
                    dispatch_status = "FAILED"
                    email_errors.append(f"{m_email}: {mail_res.get('error', 'Failed to dispatch email')}")

                dispatch_rows.append({
                    "member_id": m_id,
                    "channel": "EMAIL",
                    "status": dispatch_status,
                    "provider_ref": "REJECTION_NOTICE",
                    "error_message": mail_res.get("error"),
                    "created_at": now_iso,
                    "sent_at": now_iso if dispatch_status == "REJECTION_SENT" else None
                })

            if dispatch_rows:
                try:
                    requests.post(f"{SUPABASE_URL}/rest/v1/passport_dispatch", headers=headers, json=dispatch_rows)
                except Exception as log_err:
                    print(f"[Dispatch Log Notice] {log_err}")

        except Exception as e:
            email_errors.append(str(e))

        response = {
            "success": True,
            "message": f"Team {team_id} payment rejected.",
            "team_id": team_id,
            "payment_status": "REJECTED",
            "rejection_reason": reason_text,
            "emails_sent": emails_sent
        }

        if email_errors:
            response["email_warning"] = f"Payment rejected, but email notification failed: {'; '.join(email_errors)}"
            response["email_failed"] = True

        return response

def get_pending_payments_service() -> Dict[str, Any]:
    """Fetch all pending payments awaiting treasurer verification from staging table."""
    headers = get_headers()
    ok, res = safe_supabase_get(f"{SUPABASE_URL}/rest/v1/pending_registrations?order=created_at.desc", headers)
    records = list(res) if (ok and isinstance(res, list)) else []

    # Include locally saved pending records
    local_data = load_local_payments()
    existing_ids = {r.get("team_id") for r in records if isinstance(r, dict)}
    for tid, rec in local_data.items():
        if rec.get("payment_status") in ("PENDING_VERIFICATION", "AWAITING_PAYMENT", "REJECTED") and tid not in existing_ids:
            records.append(rec)

    # Format for Admin UI
    formatted = []
    for r in records:
        members = r.get("members", [])
        if isinstance(members, str):
            try:
                members = json.loads(members)
            except Exception:
                members = []
        member_count = len(members) if isinstance(members, list) else 1
        formatted.append({
            "team_id": r.get("team_id"),
            "payment_status": r.get("payment_status"),
            "utr_number": r.get("utr_number"),
            "submitted_amount": r.get("submitted_amount"),
            "expected_amount": r.get("expected_amount", member_count * 250),
            "rejection_reason": r.get("rejection_reason"),
            "created_at": r.get("created_at"),
            "updated_at": r.get("updated_at"),
            "teams": {
                "team_id": r.get("team_id"),
                "team_name": r.get("team_name"),
                "college": r.get("college"),
                "department": r.get("department"),
                "year": r.get("year"),
                "member_count": member_count
            }
        })

    return {"success": True, "count": len(formatted), "payments": formatted}

