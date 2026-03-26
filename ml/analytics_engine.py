import sys
import json
import math
import statistics
import pickle
import os
from datetime import datetime, time, timezone, timedelta

MODEL_PATH    = os.path.join(os.path.dirname(__file__), 'model.pkl')
FEATURES_PATH = os.path.join(os.path.dirname(__file__), 'model_features.json')

try:
    with open(MODEL_PATH, 'rb') as f:
        _model = pickle.load(f)
    with open(FEATURES_PATH, 'r') as f:
        _model_features = json.load(f)
except Exception:
    _model = None
    _model_features = None


def _parse_iso_datetime(value):
    """
    Accept ISO strings from Node (`toISOString()`).
    Handles trailing 'Z' by converting to '+00:00'.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def _parse_hhmm(value):
    """
    Timetable `startTime` is stored as "HH:MM".
    """
    if not value:
        return None
    parts = str(value).split(":")
    if len(parts) != 2:
        return None
    try:
        hh = int(parts[0])
        mm = int(parts[1])
        return time(hh, mm)
    except Exception:
        return None


def _get_schedule_day_from_datetime(dt):
    """
    Convert datetime to schedule day (0=Sun ... 6=Sat).
    """
    return (dt.weekday() + 1) % 7


def _linear_regression_slope(xs, ys):
    """
    Simple slope calculation without external dependencies.
    slope = cov(x,y) / var(x)
    """
    n = len(xs)
    if n < 2:
        return 0.0
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    cov = 0.0
    var = 0.0
    for x, y in zip(xs, ys):
        cov += (x - x_mean) * (y - y_mean)
        var += (x - x_mean) * (x - x_mean)
    if var == 0:
        return 0.0
    return cov / var


def _safe_round_pct(value):
    try:
        v = float(value)
    except Exception:
        return 0
    if math.isnan(v) or math.isinf(v):
        return 0
    return int(round(v))


def _now_utc():
    """Return current UTC datetime (timezone-aware)."""
    return datetime.now(tz=timezone.utc)


def _compute_best_delay_for_log(log, log_dt, schedule):
    """
    Pick the scheduled slot for the same subject + same dayOfWeek
    that minimizes abs(delay).
    """
    subject = log.get("subject") or {}
    slot_candidates = [
        s for s in schedule
        if s.get("subject", {}).get("subjectName") == subject.get("subjectName")
        and s.get("dayOfWeek") == _get_schedule_day_from_datetime(log_dt)
    ]

    if not slot_candidates:
        return None

    best = None
    best_abs = None

    for s in slot_candidates:
        start_t = _parse_hhmm(s.get("startTime"))
        if start_t is None:
            continue
        scheduled_dt = datetime.combine(log_dt.date(), start_t)
        if log_dt.tzinfo is not None:
            scheduled_dt = scheduled_dt.replace(tzinfo=log_dt.tzinfo)
        delay_minutes = (log_dt - scheduled_dt).total_seconds() / 60.0
        abs_delay = abs(delay_minutes)
        if best is None or abs_delay < best_abs:
            best = delay_minutes
            best_abs = abs_delay

    return best


def _build_risk_and_reasons(all_logs, schedule, session_counts=None):
    """
    Multi-Tier Temporal Analysis:
    - Tier 1: Full semester attendance percentage (threshold: < 75% = at-risk)
              Uses actual total session count from session_counts, NOT len(all_logs),
              because absent students may have no Attendance record at all.
    - Tier 2: Last-7-days window for trend/velocity and risk level
    """
    student = all_logs[0].get("studentId") or {}
    subject = all_logs[0].get("subject") or {}
    subject_id = subject.get("subjectId")

    now = _now_utc()
    seven_days_ago = now - timedelta(days=7)

    # ── Tier 1: Full semester stats ──────────────────────────────────────────
    # Use actual session count as denominator — absent students have no log records,
    # so len(all_logs) would give 100% for a student who only attended 3 of 5 sessions.
    total_sessions_actual = (session_counts or {}).get(subject_id, len(all_logs))
    present_count = sum(1 for l in all_logs if l.get("status") in ("present", "late"))
    attendance_pct = 0.0 if total_sessions_actual == 0 else (present_count / total_sessions_actual) * 100.0
    total_sessions = total_sessions_actual

    # ── Tier 2: Last-7-day window ────────────────────────────────────────────
    recent_logs = []
    for l in all_logs:
        log_ts = _parse_iso_datetime(l.get("timestamp"))
        if log_ts is None:
            continue
        # Make timezone-aware for comparison
        if log_ts.tzinfo is None:
            log_ts = log_ts.replace(tzinfo=timezone.utc)
        if log_ts >= seven_days_ago:
            recent_logs.append(l)

    # Attendance velocity over the past 7 days
    by_day = {}
    for l in recent_logs:
        log_ts = _parse_iso_datetime(l.get("timestamp"))
        if log_ts is None:
            continue
        day_key = log_ts.date().isoformat()
        if day_key not in by_day:
            by_day[day_key] = {"total": 0, "present": 0}
        by_day[day_key]["total"] += 1
        if l.get("status") in ("present", "late"):
            by_day[day_key]["present"] += 1

    sorted_days = sorted(by_day.keys())
    attendance_series = []
    for d in sorted_days:
        total = by_day[d]["total"]
        present = by_day[d]["present"]
        pct = 0.0 if total == 0 else (present / total) * 100.0
        attendance_series.append(pct)

    xs = list(range(len(attendance_series)))
    slope = _linear_regression_slope(xs, attendance_series) if len(attendance_series) >= 2 else 0.0

    # Recent attendance rate (last 7 days)
    recent_total = len(recent_logs)
    recent_present = sum(1 for l in recent_logs if l.get("status") in ("present", "late"))
    recent_pct = 0.0 if recent_total == 0 else (recent_present / recent_total) * 100.0

    # Trend classification — default Stable when fewer than 2 days of recent data
    if len(sorted_days) < 2:
        trend = "Stable"
        trend_symbol = "→"
    elif slope > 5.0:
        trend = "Improving"
        trend_symbol = "↑"
    elif slope < -5.0:
        trend = "Declining"
        trend_symbol = "↓"
    else:
        trend = "Stable"
        trend_symbol = "→"

    # Risk level: primarily driven by recent behavior when data exists,
    # otherwise fall back to semester percentage only.
    if recent_total == 0:
        # No recent data — base risk purely on semester attendance
        if attendance_pct < 50.0:
            risk_level = "High"
        elif attendance_pct < 75.0:
            risk_level = "Medium"
        else:
            risk_level = "Low"
    elif trend == "Declining" or recent_pct < 50.0:
        risk_level = "High"
    elif trend == "Improving" and recent_pct >= 70.0:
        risk_level = "Low"
    else:
        risk_level = "Medium"

    # Integrity factor: overrides among face/qr logs (all time)
    faceqr_logs = [l for l in all_logs if l.get("method") in ("face", "qr")]
    faceqr_count = len(faceqr_logs)
    override_count = sum(1 for l in faceqr_logs if l.get("isOverride") is True)

    # Punctuality: average delay using recent logs
    delays = []
    for l in recent_logs:
        log_ts = _parse_iso_datetime(l.get("timestamp"))
        if log_ts is None:
            continue
        scheduled_delay = _compute_best_delay_for_log(l, log_ts, schedule)
        if scheduled_delay is not None:
            delays.append(scheduled_delay)
    avg_delay = statistics.mean(delays) if delays else None

    # Human-readable label combining risk + trend
    risk_label = f"{risk_level} ({trend})"

    # ── Extra features for ML model ──────────────────────────────────────────
    sorted_logs_by_time = sorted(all_logs, key=lambda l: l.get("timestamp") or "")
    half = max(1, len(sorted_logs_by_time) // 2)
    early_logs = sorted_logs_by_time[:half]
    late_logs  = sorted_logs_by_time[half:]

    early_present_ml = sum(1 for l in early_logs if l.get("status") in ("present", "late"))
    early_attendance_pct = (early_present_ml / len(early_logs)) * 100.0 if early_logs else 0.0

    late_present_ml = sum(1 for l in late_logs if l.get("status") in ("present", "late"))
    late_attendance_pct = (late_present_ml / len(late_logs)) * 100.0 if late_logs else 0.0

    # Longest consecutive absence streak — late counts as present, not absent
    max_streak = 0
    current_streak = 0
    for l in sorted_logs_by_time:
        if l.get("status") not in ("present", "late"):
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 0

    # Override ratio (overrides / total records)
    override_ratio = override_count / max(len(all_logs), 1)

    # Face method ratio
    face_ratio = sum(1 for l in all_logs if l.get("method") == "face") / max(len(all_logs), 1)

    # Morning session ratio (timestamp hour < 12 UTC)
    morning_count = 0
    for l in all_logs:
        ts = _parse_iso_datetime(l.get("timestamp"))
        if ts is not None:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts.hour < 12:
                morning_count += 1
    morning_ratio = morning_count / max(len(all_logs), 1)

    # ML failure probability
    fail_probability = None
    if _model is not None and _model_features is not None:
        try:
            feature_vector = [
                early_attendance_pct,
                late_attendance_pct,
                slope,
                float(max_streak),
                override_ratio,
                face_ratio,
                morning_ratio,
                float(total_sessions),
            ]
            prob = _model.predict_proba([feature_vector])[0][1]
            fail_probability = int(round(prob * 100))
        except Exception:
            fail_probability = None

    return {
        "name": student.get("name"),
        "email": student.get("email"),
        "subject": subject.get("subjectName"),
        # Tier 1 (semester)
        "attendancePercentage": _safe_round_pct(attendance_pct),
        "totalSessions": total_sessions,
        "presentCount": present_count,
        # Tier 2 (recent)
        "riskLevel": risk_level,
        "trend": trend,
        "trendSymbol": trend_symbol,
        "riskLabel": risk_label,
        "recentAttendancePercentage": _safe_round_pct(recent_pct),
        "recentPresent": recent_present,
        "recentTotal": recent_total,
        "velocitySlope": round(slope, 2),
        # Integrity
        "overrideCount": override_count,
        "faceQrCount": faceqr_count,
        # Punctuality
        "avgDelayMinutes": round(avg_delay, 1) if avg_delay is not None else None,
        # ML prediction
        "failProbability": fail_probability,
    }


def _analyze_timetable_slot_suitability(logs, schedule):
    """
    Tier 3 – TSSI (Timetable Slot Suitability Index):

    - Only runs if dataset spans >= 7 days.
    - Uses an Expanding Window (all logs up to 30 days old).
    - Only suggests swaps if a slot has >= 2 sessions and significant engagement drop.
    """
    if not logs:
        return []

    # Check span of available data
    timestamps = []
    for l in logs:
        ts = _parse_iso_datetime(l.get("timestamp"))
        if ts is not None:
            timestamps.append(ts)

    if len(timestamps) < 2:
        return []

    min_ts = min(timestamps)
    max_ts = max(timestamps)
    span_days = (max_ts - min_ts).total_seconds() / 86400.0

    # Threshold: need at least 7 days of data
    if span_days < 7.0:
        return []

    # Expanding window: use up to 30 days of data
    now = _now_utc()
    thirty_days_ago = now - timedelta(days=30)
    window_logs = []
    for l in logs:
        ts = _parse_iso_datetime(l.get("timestamp"))
        if ts is None:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts >= thirty_days_ago:
            window_logs.append(l)

    if not window_logs:
        return []

    # Build subject -> slots index
    subjects = {}
    for s in schedule:
        subj = s.get("subject", {}).get("subjectName")
        if not subj:
            continue
        subjects.setdefault(subj, [])
        subjects[subj].append(s)

    # Initialize per-slot metrics
    slot_metrics = {}
    for subj, slots in subjects.items():
        for s in slots:
            slot_key = f"{s.get('dayOfWeek')}-{s.get('startTime')}"
            slot_metrics.setdefault(subj, {})
            slot_metrics[subj].setdefault(slot_key, {
                "subject": subj,
                "dayOfWeek": s.get("dayOfWeek"),
                "startTime": s.get("startTime"),
                "total": 0,
                "present": 0,
                "delays": []
            })

    # Assign logs to best matching slot
    for l in window_logs:
        subject = l.get("subject", {}).get("subjectName")
        if not subject or subject not in slot_metrics:
            continue
        log_ts = _parse_iso_datetime(l.get("timestamp"))
        if log_ts is None:
            continue

        candidate_slots = [
            s for s in schedule
            if s.get("subject", {}).get("subjectName") == subject
            and s.get("dayOfWeek") == _get_schedule_day_from_datetime(log_ts)
        ]
        if not candidate_slots:
            continue

        best_delay = None
        best_slot = None
        best_abs = None
        for s in candidate_slots:
            start_t = _parse_hhmm(s.get("startTime"))
            if start_t is None:
                continue
            scheduled_dt = datetime.combine(log_ts.date(), start_t)
            if log_ts.tzinfo is not None:
                scheduled_dt = scheduled_dt.replace(tzinfo=log_ts.tzinfo)
            delay_minutes = (log_ts - scheduled_dt).total_seconds() / 60.0
            abs_delay = abs(delay_minutes)
            if best_slot is None or abs_delay < best_abs:
                best_slot = s
                best_delay = delay_minutes
                best_abs = abs_delay

        if best_slot is None:
            continue

        slot_key = f"{best_slot.get('dayOfWeek')}-{best_slot.get('startTime')}"
        m = slot_metrics[subject][slot_key]
        m["total"] += 1
        if l.get("status") in ("present", "late"):
            m["present"] += 1
        if best_delay is not None:
            m["delays"].append(best_delay)

    def compute_slot_attendance_pct(m):
        if m["total"] == 0:
            return 0.0
        return (m["present"] / m["total"]) * 100.0

    def compute_slot_avg_delay(m):
        return statistics.mean(m["delays"]) if m["delays"] else 0.0

    slot_suggestions = []
    for subj, by_key in slot_metrics.items():
        # Only slots with at least 2 sessions (Tier 3 trigger condition)
        stable_slots = [m for m in by_key.values() if m["total"] >= 2]
        if not stable_slots:
            continue

        attendance_pcts = [compute_slot_attendance_pct(m) for m in stable_slots]
        delays = [compute_slot_avg_delay(m) for m in stable_slots]

        median_att = statistics.median(attendance_pcts)
        median_delay = statistics.median(delays)

        # Best slot: highest attendance, then lowest lateness
        best_slot = None
        best_att = None
        best_delay_val = None
        for m in stable_slots:
            ap = compute_slot_attendance_pct(m)
            ad = compute_slot_avg_delay(m)
            if best_slot is None or ap > best_att or (ap == best_att and ad < best_delay_val):
                best_slot = m
                best_att = ap
                best_delay_val = ad

        for m in stable_slots:
            slot_att = compute_slot_attendance_pct(m)
            slot_delay = compute_slot_avg_delay(m)
            attendance_drop = median_att - slot_att
            delay_spike = slot_delay - median_delay

            mismatched = (attendance_drop >= 10.0) or (delay_spike >= 15.0)
            if not mismatched:
                continue

            from_time = m.get("startTime")
            to_time = best_slot.get("startTime") if best_slot else None

            lower_att_txt = f"{abs(attendance_drop):.0f}% lower engagement than subject average"
            higher_delay_txt = f"{abs(delay_spike):.0f} min higher avg lateness than subject average"
            if attendance_drop >= 10.0 and delay_spike < 15.0:
                impact = lower_att_txt
            elif delay_spike >= 15.0 and attendance_drop < 10.0:
                impact = higher_delay_txt
            else:
                impact = f"{lower_att_txt} and {higher_delay_txt}"

            if to_time and to_time != from_time:
                suggestion = (
                    f"{subj} at {from_time}: {impact}. "
                    f"Suggest swapping this slot with the {to_time} slot."
                )
            else:
                suggestion = (
                    f"{subj} at {from_time}: {impact}. "
                    f"Consider revising scheduling for this time slot."
                )

            slot_suggestions.append({
                "subject": subj,
                "fromStartTime": from_time,
                "toStartTime": to_time,
                "impact": impact,
                "suggestion": suggestion
            })

    return slot_suggestions


def main():
    raw = sys.stdin.read()
    if not raw:
        print(json.dumps({"error": "No input received"}))
        return

    try:
        payload = json.loads(raw)
    except Exception as e:
        print(json.dumps({"error": f"Invalid JSON input: {e}"}))
        return

    logs = payload.get("logs") or []
    schedule = payload.get("schedule") or []
    session_counts = payload.get("sessionCounts") or {}

    # Group logs by (student, subject)
    # Guard: skip any log where student name or email is missing — prevents
    # multiple students collapsing into a single (None, None, None) group.
    grouped = {}
    skipped = 0
    for l in logs:
        student = l.get("studentId") or {}
        subject = l.get("subject") or {}
        name = student.get("name")
        email = student.get("email")
        subj_name = subject.get("subjectName")
        if not name or not email or not subj_name:
            skipped += 1
            continue
        key = (name, email, subj_name)
        grouped.setdefault(key, []).append(l)

    at_risk = []
    for key, group_logs in grouped.items():
        risk = _build_risk_and_reasons(group_logs, schedule, session_counts)
        # Tier 1 criterion: any student with semester attendance < 75% is at-risk
        if risk.get("attendancePercentage", 100) < 75:
            at_risk.append(risk)

    # Sort: High risk first, then by attendance ascending (worst first)
    risk_order = {"High": 0, "Medium": 1, "Low": 2}
    at_risk.sort(key=lambda r: (risk_order.get(r.get("riskLevel", "Low"), 2), r.get("attendancePercentage", 0)))

    # Tier 3: Timetable suitability
    slot_suggestions = _analyze_timetable_slot_suitability(logs, schedule)

    result = {
        "atRiskStudents": at_risk,
        "slotSuggestions": slot_suggestions
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()