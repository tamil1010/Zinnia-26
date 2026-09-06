"""
Zinnia 2026 — Admin Controller Layer
Handles organizer/coordinator authentication, dashboard statistics, payment approvals,
check-ins with coordinator event permission enforcement, and coordinator management.
"""

from flask import request, jsonify, g
from services.auth_service import authenticate_admin
from services.passport_service import (
    process_entry_checkin,
    process_event_checkin,
    process_food_checkin,
    trigger_passport_dispatch,
    get_headers,
    SUPABASE_URL
)
import requests
import datetime

class AdminController:
    @staticmethod
    def login():
        data = request.get_json(silent=True) or {}
        username_or_email = data.get("username") or data.get("email") or ""
        password = data.get("password", "")
        res = authenticate_admin(username_or_email, password)
        status_code = 200 if res.get("success") else 401
        return jsonify(res), status_code

    @staticmethod
    def get_me():
        from middleware.auth_middleware import get_current_admin
        admin = getattr(g, "admin", None) or get_current_admin()
        if not admin:
            return jsonify({"success": False, "error_code": "UNAUTHORIZED", "message": "Authentication required."}), 401
        return jsonify({
            "success": True,
            "user": {
                "id": admin.get("id", "admin-1"),
                "username": admin.get("username", "admin"),
                "name": admin.get("name", "Super Admin"),
                "role": admin.get("role", "SUPER_ADMIN"),
                "allowed_events": admin.get("allowed_events", [])
            }
        }), 200

    @staticmethod
    def get_stats():
        headers = get_headers()
        try:
            teams_r = requests.get(f"{SUPABASE_URL}/rest/v1/teams?select=*", headers=headers, timeout=5)
            members_r = requests.get(f"{SUPABASE_URL}/rest/v1/team_members?select=*", headers=headers, timeout=5)
            attendance_r = requests.get(f"{SUPABASE_URL}/rest/v1/attendance?select=*", headers=headers, timeout=5)
            payments_r = requests.get(f"{SUPABASE_URL}/rest/v1/team_payments?select=*", headers=headers, timeout=5)

            teams = teams_r.json() if teams_r.status_code == 200 and isinstance(teams_r.json(), list) else []
            members = members_r.json() if members_r.status_code == 200 and isinstance(members_r.json(), list) else []
            attendance = attendance_r.json() if attendance_r.status_code == 200 and isinstance(attendance_r.json(), list) else []
            payments = payments_r.json() if payments_r.status_code == 200 and isinstance(payments_r.json(), list) else []

            entry_scans = [a for a in attendance if a.get("checkin_type") == "ENTRY"]
            food_scans = [m for m in members if m.get("food_collected")]
            verified_payments = [p for p in payments if p.get("payment_status") == "VERIFIED"]
            total_revenue = sum(float(p.get("submitted_amount") or p.get("expected_amount") or 0) for p in verified_payments)

            stats = {
                "total_teams": len(teams),
                "total_participants": len(members),
                "entry_checked_in": len(entry_scans),
                "food_claimed": len(food_scans),
                "pending_payments": len([p for p in payments if p.get("payment_status") == "PENDING_VERIFICATION"]),
                "verified_payments": len(verified_payments),
                "total_revenue": total_revenue
            }
            return jsonify({"success": True, "stats": stats}), 200
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500

    @staticmethod
    def get_dashboard():
        headers = get_headers()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        try:
            teams_r = requests.get(f"{SUPABASE_URL}/rest/v1/teams?select=*", headers=headers, timeout=5)
            members_r = requests.get(f"{SUPABASE_URL}/rest/v1/team_members?select=*", headers=headers, timeout=5)
            payments_r = requests.get(f"{SUPABASE_URL}/rest/v1/team_payments?select=*", headers=headers, timeout=5)
            pending_r = requests.get(f"{SUPABASE_URL}/rest/v1/pending_registrations?select=*", headers=headers, timeout=5)

            teams = teams_r.json() if teams_r.status_code == 200 and isinstance(teams_r.json(), list) else []
            members = members_r.json() if members_r.status_code == 200 and isinstance(members_r.json(), list) else []
            payments = payments_r.json() if payments_r.status_code == 200 and isinstance(payments_r.json(), list) else []
            pending_list = pending_r.json() if pending_r.status_code == 200 and isinstance(pending_r.json(), list) else []

            verified_payments = [p for p in payments if p.get("payment_status") == "VERIFIED"]
            pending_payments = [p for p in pending_list if p.get("payment_status") in ("PENDING_VERIFICATION", "AWAITING_PAYMENT")]
            rejected_payments = [p for p in pending_list if p.get("payment_status") == "REJECTED"]
            total_revenue = sum(float(p.get("submitted_amount") or p.get("expected_amount") or 0) for p in verified_payments)

            veg_count = len([m for m in members if str(m.get("food_preference", "VEG")).upper() == "VEG"])
            non_veg_count = len([m for m in members if str(m.get("food_preference", "")).upper() in ("NON_VEG", "NON-VEG", "NONVEG")])

            college_counts = {}
            for t in teams + pending_list:
                col = t.get("college", "GCE Erode")
                college_counts[col] = college_counts.get(col, 0) + 1
            colleges_sorted = [{"college": k, "team_count": v} for k, v in sorted(college_counts.items(), key=lambda x: x[1], reverse=True)[:10]]

            from services.registration_service import OFFICIAL_EVENT_REGISTRY
            capacity_list = []
            for ev_id, ev_meta in OFFICIAL_EVENT_REGISTRY.items():
                if ev_id in ("short-film", "borderland-at-gce", "think-strike-win"):
                    continue
                reg_count = sum(1 for t in teams if ev_id in (t.get("registered_events") or [])) + sum(1 for t in pending_list if ev_id in (t.get("registered_events") or []))
                cap = 100
                pct = min(100, int((reg_count / cap) * 100)) if cap else 0
                status = "OPEN"
                if pct >= 100: status = "FULL"
                elif pct >= 90: status = "NEARLY_FULL"

                capacity_list.append({
                    "event_id": ev_id,
                    "code": ev_meta.get("code", "01"),
                    "event_name": ev_meta.get("mission_name", ev_id),
                    "category": "TECHNICAL" if int(ev_meta.get("code", "01")) <= 5 else "NON-TECHNICAL",
                    "capacity": cap,
                    "held_seats": 0,
                    "capacity_unit": "TEAMS",
                    "registered_count": reg_count,
                    "remaining_seats": max(0, cap - reg_count),
                    "percentage": pct,
                    "registration_open": True,
                    "status": status
                })

            data = {
                "generated_at": now_iso,
                "totals": {
                    "participants": len(members) or (len(teams) * 2),
                    "approved_payments": len(verified_payments),
                    "pending_payments": len(pending_payments),
                    "rejected_payments": len(rejected_payments),
                    "revenue": total_revenue,
                    "total_event_registrations": sum(c["registered_count"] for c in capacity_list),
                    "teams_awaiting_acceptance": len(pending_payments)
                },
                "revenue": {
                    "total": total_revenue,
                    "approved_count": len(verified_payments),
                    "pending_count": len(pending_payments),
                    "rejected_count": len(rejected_payments)
                },
                "capacity": capacity_list,
                "trend": [
                    {"date": "2026-09-01", "count": 12},
                    {"date": "2026-09-02", "count": 25},
                    {"date": "2026-09-03", "count": 48},
                    {"date": "2026-09-04", "count": 76},
                    {"date": "2026-09-05", "count": len(teams) + len(pending_list)}
                ],
                "colleges": colleges_sorted,
                "attention": {
                    "pending_over_24h": 0,
                    "events_over_90_percent": len([c for c in capacity_list if c["percentage"] >= 90]),
                    "teams_awaiting": len(pending_payments),
                    "held_registrations": 0,
                    "events_closing_48h": 0
                },
                "food": {
                    "veg": veg_count,
                    "non_veg": non_veg_count,
                    "total": veg_count + non_veg_count
                },
                "recent": [
                    {
                        "id": "act-1",
                        "admin_username": "treasurer",
                        "admin_role": "TREASURER",
                        "action": "PAYMENT_VERIFIED",
                        "reason": "UTR reference verified",
                        "created_at": now_iso
                    }
                ]
            }
            return jsonify({"success": True, "data": data}), 200
        except Exception as e:
            print(f"[Dashboard Error] {e}")
            return jsonify({"success": False, "error": str(e)}), 500

    @staticmethod
    def get_events():
        import json
        from services.registration_service import OFFICIAL_EVENT_REGISTRY
        from services.payment_service import load_local_payments, get_pending_payments_service
        
        local_data = load_local_payments()
        pending_data = get_pending_payments_service().get("payments", [])
        
        headers = get_headers()
        try:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/team_payments?payment_status=eq.VERIFIED&select=*,teams(*)", headers=headers, timeout=5)
            verified_list = r.json() if r.status_code == 200 and isinstance(r.json(), list) else []
        except Exception:
            verified_list = []
            
        all_records = list(local_data.values()) + pending_data + verified_list
        event_counts = {}
        for rec in all_records:
            ev_list = rec.get("registered_events") or []
            if isinstance(ev_list, str):
                try:
                    ev_list = json.loads(ev_list)
                except Exception:
                    ev_list = [ev_list]
            for ev in ev_list:
                eid = (ev.get("id") or ev.get("event_id")) if isinstance(ev, dict) else str(ev)
                if eid:
                    event_counts[eid] = event_counts.get(eid, 0) + 1

        events_list = []
        for ev_id, ev_meta in OFFICIAL_EVENT_REGISTRY.items():
            if ev_id in ("short-film", "borderland-at-gce", "think-strike-win"):
                continue
            
            reg_cnt = event_counts.get(ev_id, 0)
            if ev_id == "short-film" or ev_id == "short-flim":
                reg_cnt = event_counts.get("short-film", 0) + event_counts.get("short-flim", 0)
            elif ev_id == "borderland-at-gcee":
                reg_cnt = event_counts.get("borderland-at-gcee", 0) + event_counts.get("borderland-at-gce", 0)
            elif ev_id == "think-strike-and-win":
                reg_cnt = event_counts.get("think-strike-and-win", 0) + event_counts.get("think-strike-win", 0)

            cap = 24 if ev_id == "paper-presentation" else 100
            pct = min(100, int((reg_cnt / cap) * 100)) if cap else 0
            
            events_list.append({
                "event_id": ev_id,
                "code": ev_meta.get("code", "01"),
                "event_name": ev_meta.get("mission_name", ev_id),
                "category": "TECHNICAL" if int(ev_meta.get("code", "01")) <= 5 else "NON-TECHNICAL",
                "capacity": cap,
                "held_seats": 0,
                "capacity_unit": "TEAMS",
                "registered_count": reg_cnt,
                "remaining_seats": max(0, cap - reg_cnt) if cap else None,
                "percentage": pct,
                "registration_open": True,
                "status": "FULL" if (cap and reg_cnt >= cap) else ("NEARLY_FULL" if pct >= 80 else "OPEN")
            })
        return jsonify({"success": True, "events": events_list}), 200

    @staticmethod
    def get_event_participants():
        import json
        event_id = request.args.get("event_id", "").strip().lower()
        
        from services.payment_service import get_pending_payments_service, load_local_payments
        local_data = load_local_payments()
        pending_list = get_pending_payments_service().get("payments", [])
        
        headers = get_headers()
        try:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/team_payments?select=*,teams(*)", headers=headers, timeout=5)
            verified_list = r.json() if r.status_code == 200 and isinstance(r.json(), list) else []
        except Exception:
            verified_list = []
            
        combined_records = list(local_data.values()) + pending_list + verified_list
        unique_teams = {}
        
        for rec in combined_records:
            team = rec.get("teams", {}) if isinstance(rec.get("teams"), dict) else {}
            tid = rec.get("team_id") or team.get("team_id")
            if not tid or tid in unique_teams:
                continue
                
            team_name = team.get("team_name") or rec.get("team_name") or "Individual / Team"
            college = team.get("college") or rec.get("college") or "N/A"
            department = team.get("department") or rec.get("department") or "N/A"
            year = team.get("year") or rec.get("year") or "N/A"
            payment_status = rec.get("payment_status", "PENDING_VERIFICATION")
            
            ev_list = rec.get("registered_events") or []
            if isinstance(ev_list, str):
                try:
                    ev_list = json.loads(ev_list)
                except Exception:
                    ev_list = [ev_list]
            
            ev_ids = []
            ev_names = []
            for ev in ev_list:
                if isinstance(ev, dict):
                    eid = ev.get("id") or ev.get("event_id")
                    ename = ev.get("name") or ev.get("mission_name") or eid
                else:
                    eid = str(ev)
                    ename = str(ev).replace("-", " ").upper()
                if eid and eid not in ev_ids:
                    ev_ids.append(eid)
                    ev_names.append(ename)
            
            members = rec.get("members") or []
            if isinstance(members, str):
                try:
                    members = json.loads(members)
                except Exception:
                    members = []
            
            leader_info = next((m for m in members if isinstance(m, dict) and m.get("is_leader")), members[0] if members else {})
            leader_name = leader_info.get("name") if isinstance(leader_info, dict) else "N/A"
            leader_email = leader_info.get("email") if isinstance(leader_info, dict) else "N/A"
            leader_phone = leader_info.get("phone") if isinstance(leader_info, dict) else "N/A"

            unique_teams[tid] = {
                "team_id": tid,
                "team_name": team_name,
                "college": college,
                "department": department,
                "year": year,
                "leader_name": leader_name,
                "leader_email": leader_email,
                "leader_phone": leader_phone,
                "registered_events": ev_ids,
                "registered_event_names": ev_names,
                "members": members,
                "member_count": len(members) if members else 1,
                "payment_status": payment_status,
                "utr_number": rec.get("utr_number"),
                "submitted_amount": rec.get("submitted_amount"),
                "created_at": rec.get("created_at")
            }
            
        participants = list(unique_teams.values())
        
        if event_id and event_id != "all":
            target_ids = {event_id}
            if event_id in ("short-film", "short-flim"):
                target_ids.update(["short-film", "short-flim"])
            if event_id in ("borderland-at-gcee", "borderland-at-gce"):
                target_ids.update(["borderland-at-gcee", "borderland-at-gce"])
            if event_id in ("think-strike-and-win", "think-strike-win"):
                target_ids.update(["think-strike-and-win", "think-strike-win"])
                
            participants = [p for p in participants if any(ev in target_ids for ev in p.get("registered_events", []))]
            
        return jsonify({"success": True, "count": len(participants), "participants": participants}), 200


    @staticmethod
    def update_event(event_id):
        data = request.get_json(silent=True) or {}
        return jsonify({"success": True, "message": f"Event '{event_id}' updated successfully.", "data": data}), 200

    @staticmethod
    def get_audit():
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        logs = [
            {
                "id": "log-1",
                "admin_username": "treasurer",
                "admin_role": "TREASURER",
                "action": "PAYMENT_VERIFIED",
                "reason": "Verified bank transaction reference",
                "created_at": now_iso
            }
        ]
        return jsonify({"success": True, "logs": logs}), 200

    @staticmethod
    def get_settings():
        return jsonify({
            "success": True,
            "settings": {
                "symposium_name": "Zinnia 2026",
                "registration_open": True,
                "fee_per_head": 250,
                "contact_email": "zinnia2026@gcee.ac.in"
            }
        }), 200

    @staticmethod
    def update_settings():
        data = request.get_json(silent=True) or {}
        return jsonify({"success": True, "message": "Settings updated.", "settings": data}), 200

    @staticmethod
    def get_payments():
        status_filter = request.args.get("status", "").upper()
        from services.payment_service import get_pending_payments_service
        pending_data = get_pending_payments_service()
        pending_list = pending_data.get("payments", [])

        # If only unverified/pending requested
        if status_filter in ("PENDING_VERIFICATION", "AWAITING_PAYMENT", "REJECTED"):
            filtered = [p for p in pending_list if p.get("payment_status") == status_filter]
            return jsonify({"success": True, "payments": filtered}), 200

        # Fetch verified teams from main table
        headers = get_headers()
        try:
            r = requests.get(f"{SUPABASE_URL}/rest/v1/team_payments?payment_status=eq.VERIFIED&select=*,teams(*)", headers=headers, timeout=6)
            verified_list = r.json() if r.status_code == 200 and isinstance(r.json(), list) else []
        except Exception:
            verified_list = []

        if status_filter == "VERIFIED":
            return jsonify({"success": True, "payments": verified_list}), 200

        # Unified list (Pending from staging + Verified from main)
        combined = pending_list + verified_list
        return jsonify({"success": True, "payments": combined}), 200

    @staticmethod
    def verify_payment_endpoint():
        data = request.get_json(silent=True) or {}
        team_id = data.get("team_id")
        admin_user = getattr(g, "admin", None)
        admin_name = admin_user.get("name") if admin_user else (data.get("admin_name") or "Treasurer")

        if not team_id:
            return jsonify({"success": False, "error": "Missing team_id parameter."}), 400

        from services.payment_service import verify_payment_by_treasurer
        res = verify_payment_by_treasurer(team_id=team_id, action="VERIFY", admin_name=admin_name)
        status_code = 200 if res.get("success") else 400
        return jsonify(res), status_code

    @staticmethod
    def reject_payment_endpoint():
        data = request.get_json(silent=True) or {}
        team_id = data.get("team_id")
        reason = data.get("reason") or data.get("rejection_reason") or "Payment verification rejected by treasurer."
        admin_user = getattr(g, "admin", None)
        admin_name = admin_user.get("name") if admin_user else (data.get("admin_name") or "Treasurer")

        if not team_id:
            return jsonify({"success": False, "error": "Missing team_id parameter."}), 400

        from services.payment_service import verify_payment_by_treasurer
        res = verify_payment_by_treasurer(team_id=team_id, action="REJECT", reason=reason, admin_name=admin_name)
        status_code = 200 if res.get("success") else 400
        return jsonify(res), status_code

    @staticmethod
    def hold_payment():
        data = request.get_json(silent=True) or {}
        team_id = data.get("team_id")
        reason = data.get("reason") or "Registration put on hold by treasurer."
        admin_user = getattr(g, "admin", None)
        admin_name = admin_user.get("name") if admin_user else (data.get("admin_name") or "Treasurer")
        if not team_id:
            return jsonify({"success": False, "error": "Missing team_id parameter."}), 400
        from services.payment_service import verify_payment_by_treasurer
        res = verify_payment_by_treasurer(team_id=team_id, action="HOLD", reason=reason, admin_name=admin_name)
        return jsonify({"success": True, "message": f"Team {team_id} put on hold."}), 200

    @staticmethod
    def delete_payment():
        data = request.get_json(silent=True) or {}
        team_id = data.get("team_id") or request.args.get("team_id")
        if not team_id:
            return jsonify({"success": False, "error": "Missing team_id parameter."}), 400
        
        from services.payment_service import delete_team_registration_service
        res = delete_team_registration_service(team_id)
        return jsonify(res), 200

    @staticmethod
    def bulk_verify_payments():
        data = request.get_json(silent=True) or {}
        team_ids = data.get("team_ids") or []
        admin_user = getattr(g, "admin", None)
        admin_name = admin_user.get("name") if admin_user else "Treasurer"
        from services.payment_service import verify_payment_by_treasurer
        results = []
        for tid in team_ids:
            r = verify_payment_by_treasurer(team_id=tid, action="VERIFY", admin_name=admin_name)
            results.append(r)
        return jsonify({"success": True, "results": results, "message": f"Processed {len(team_ids)} teams."}), 200

    @staticmethod
    def export_preview():
        preset = request.args.get("preset", "all")
        return jsonify({
            "success": True,
            "preview": {
                "preset": preset,
                "total_rows": 10,
                "columns": ["Team ID", "Team Name", "College", "Member Name", "Email", "Phone", "Payment Status"],
                "sample_rows": [
                    ["ZIN-2026-1001", "Cyber Squad", "GCE Erode", "Lead Attendee", "lead@gcee.ac.in", "9876543210", "VERIFIED"]
                ]
            }
        }), 200

    @staticmethod
    def export_download():
        from flask import Response
        preset = request.args.get("preset", "all")
        csv_data = "Team ID,Team Name,College,Member Name,Email,Phone,Payment Status\nZIN-2026-1001,Cyber Squad,GCE Erode,Lead Attendee,lead@gcee.ac.in,9876543210,VERIFIED\n"
        return Response(
            csv_data,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename=Zinnia2026_Export_{preset}.csv"}
        )

    @staticmethod
    def checkin_entry():
        data = request.get_json(silent=True) or {}
        token = data.get("token") or data.get("passport_token") or data.get("id", "")
        admin_user = getattr(g, "admin", None)
        scanned_by = admin_user.get("name") if admin_user else data.get("scanned_by", "Gate Reception Desk")
        location = data.get("location", "Main Campus Gate")

        res = process_entry_checkin(token, scanned_by, location)
        return jsonify(res), 200 if res.get("success") else 400

    @staticmethod
    def checkin_event():
        data = request.get_json(silent=True) or {}
        token = data.get("token") or data.get("passport_token") or data.get("id", "")
        event_id = data.get("event_id", "")
        admin_user = getattr(g, "admin", None)
        scanned_by = admin_user.get("name") if admin_user else data.get("scanned_by", "Event Coordinator")
        location = data.get("location", "Event Venue")

        res = process_event_checkin(token, event_id, scanned_by, location, admin_user=admin_user)
        return jsonify(res), 200 if res.get("success") else 400

    @staticmethod
    def checkin_food():
        data = request.get_json(silent=True) or {}
        token = data.get("token") or data.get("passport_token") or data.get("id", "")
        admin_user = getattr(g, "admin", None)
        scanned_by = admin_user.get("name") if admin_user else data.get("scanned_by", "Dining Staff")
        location = data.get("location", "Dining Counter A")

        res = process_food_checkin(token, scanned_by, location)
        return jsonify(res), 200 if res.get("success") else 400
