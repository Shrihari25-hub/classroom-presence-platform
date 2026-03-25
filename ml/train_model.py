"""
train_model.py
Trains a logistic regression model on seeded historical attendance data.

Run from project root:
    python ml/train_model.py
"""

import os
import sys
import json
import pickle
from collections import defaultdict
from datetime import timezone

# ── Load .env before anything else ───────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv("backend/.env")   # path relative to project root

import numpy as np
from pymongo import MongoClient
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, confusion_matrix

# ── Paths (relative to project root) ─────────────────────────────────────────
MODEL_PATH    = os.path.join("ml", "model.pkl")
FEATURES_PATH = os.path.join("ml", "model_features.json")
MANIFEST_PATH = os.path.join("backend", "scripts", ".seed_manifest.json")

FEATURE_NAMES = [
    "early_attendance_pct",
    "late_attendance_pct",
    "trend_slope",
    "consecutive_absences_max",
    "override_ratio",
    "face_method_ratio",
    "morning_session_ratio",
    "total_sessions",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _linear_regression_slope(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    cov = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    var = sum((x - x_mean) ** 2 for x in xs)
    return 0.0 if var == 0 else cov / var


def _ensure_utc(dt):
    """Make a datetime timezone-aware (UTC) if it isn't already."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _iso_week_key(dt):
    """Return 'YYYY-WNN' string for grouping by calendar week."""
    iso = dt.isocalendar()   # (year, week, weekday)
    return f"{iso[0]}-W{iso[1]:02d}"


# ── Step 1: Connect to MongoDB ────────────────────────────────────────────────

uri = os.getenv("MONGODB_URI")
if not uri:
    print("ERROR: MONGODB_URI not found in backend/.env")
    sys.exit(1)

try:
    client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    client.admin.command("ping")
    db = client.get_default_database()
    print("Connected to MongoDB")
except Exception as e:
    print(f"ERROR: Could not connect to MongoDB — {e}")
    sys.exit(1)

# ── Step 2: Query seeded data ─────────────────────────────────────────────────
# User.js schema has no isSeeded field (Mongoose strict mode would drop it).
# Instead, read the seeded user IDs directly from the .seed_manifest.json sidecar
# written by seedHistoricalData.js — it's the authoritative source of truth.

if not os.path.exists(MANIFEST_PATH):
    print(f"ERROR: Seed manifest not found at {MANIFEST_PATH}.")
    print("Run: node backend/scripts/seedHistoricalData.js")
    sys.exit(1)

with open(MANIFEST_PATH) as f:
    manifest = json.load(f)

raw_user_ids = manifest.get("userIds", [])
if not raw_user_ids:
    print("ERROR: No userIds in seed manifest. Re-run seedHistoricalData.js.")
    sys.exit(1)

# Convert string IDs to ObjectId for MongoDB queries
from bson import ObjectId
manifest_user_oids = [ObjectId(uid) for uid in raw_user_ids]

# Filter to only students (manifest also contains seeded teachers)
seeded_users = list(db.users.find(
    {"_id": {"$in": manifest_user_oids}, "role": "student"},
    {"_id": 1, "name": 1, "email": 1}
))

if not seeded_users:
    print("ERROR: No seeded students found in the database matching manifest IDs.")
    print("The seeded users may have been cleaned up. Re-run seedHistoricalData.js.")
    sys.exit(1)

print(f"Seeded students found: {len(seeded_users)}")

seeded_ids = [u["_id"] for u in seeded_users]

# Fetch all attendance records for seeded students
attendance_records = list(db.attendances.find(
    {"student": {"$in": seeded_ids}},
    {
        "student": 1, "subject": 1, "session": 1,
        "status": 1, "method": 1, "overrideFlag": 1, "timestamp": 1
    }
))

print(f"Attendance records fetched: {len(attendance_records)}")

if not attendance_records:
    print("ERROR: No attendance records found for seeded students.")
    sys.exit(1)

# Fetch all sessions referenced by these records (for startTime / morning check)
session_ids = list({r["session"] for r in attendance_records if r.get("session")})
sessions_raw = list(db.sessions.find(
    {"_id": {"$in": session_ids}},
    {"_id": 1, "startTime": 1}
))
session_start_map = {s["_id"]: _ensure_utc(s["startTime"]) for s in sessions_raw}

# ── Step 3: Compute features per (student_id, subject_id) ────────────────────

print("Building features...")

# Group records by (student_id, subject_id)
groups = defaultdict(list)
for rec in attendance_records:
    key = (rec["student"], rec["subject"])
    groups[key].append(rec)

rows = []    # feature vectors
labels = []  # 0 = safe, 1 = at-risk

for (student_id, subject_id), recs in groups.items():
    total = len(recs)
    if total == 0:
        continue

    # Sort chronologically by timestamp for half-split and streak calculations
    recs_sorted = sorted(recs, key=lambda r: r.get("timestamp") or 0)

    # ── attendance_pct ────────────────────────────────────────────────────────
    present_count = sum(1 for r in recs_sorted if r.get("status") == "present")
    attendance_pct = (present_count / total) * 100.0

    # ── early / late attendance_pct (first half vs second half) ──────────────
    mid = total // 2
    early_recs = recs_sorted[:mid] if mid > 0 else recs_sorted
    late_recs  = recs_sorted[mid:] if mid < total else recs_sorted

    early_present = sum(1 for r in early_recs if r.get("status") == "present")
    late_present  = sum(1 for r in late_recs  if r.get("status") == "present")

    early_attendance_pct = (early_present / len(early_recs)) * 100.0 if early_recs else 0.0
    late_attendance_pct  = (late_present  / len(late_recs))  * 100.0 if late_recs  else 0.0

    # ── trend_slope (linear regression over weekly attendance percentages) ────
    by_week = defaultdict(lambda: {"total": 0, "present": 0})
    for r in recs_sorted:
        ts = _ensure_utc(r.get("timestamp"))
        if ts is None:
            continue
        wk = _iso_week_key(ts)
        by_week[wk]["total"] += 1
        if r.get("status") == "present":
            by_week[wk]["present"] += 1

    sorted_weeks = sorted(by_week.keys())
    weekly_pcts = [
        (by_week[w]["present"] / by_week[w]["total"]) * 100.0
        if by_week[w]["total"] > 0 else 0.0
        for w in sorted_weeks
    ]
    xs = list(range(len(weekly_pcts)))
    trend_slope = _linear_regression_slope(xs, weekly_pcts)

    # ── consecutive_absences_max ──────────────────────────────────────────────
    max_streak = 0
    current_streak = 0
    for r in recs_sorted:
        if r.get("status") != "present":   # absent or late both count as non-present
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 0
    consecutive_absences_max = max_streak

    # ── override_ratio ────────────────────────────────────────────────────────
    override_count = sum(1 for r in recs_sorted if r.get("overrideFlag") is True)
    override_ratio = override_count / total

    # ── face_method_ratio ─────────────────────────────────────────────────────
    face_count = sum(1 for r in recs_sorted if r.get("method") == "face")
    face_method_ratio = face_count / total

    # ── morning_session_ratio (startTime hour < 12 UTC) ──────────────────────
    morning_count = 0
    session_count_with_time = 0
    for r in recs_sorted:
        sess_id = r.get("session")
        start = session_start_map.get(sess_id)
        if start is not None:
            session_count_with_time += 1
            if start.hour < 12:
                morning_count += 1
    morning_session_ratio = (
        morning_count / session_count_with_time if session_count_with_time > 0 else 0.0
    )

    # ── total_sessions ────────────────────────────────────────────────────────
    total_sessions = total

    # ── Label: 1 = at-risk (< 75%), 0 = safe ─────────────────────────────────
    label = 1 if attendance_pct < 75.0 else 0

    rows.append([
        early_attendance_pct,
        late_attendance_pct,
        trend_slope,
        consecutive_absences_max,
        override_ratio,
        face_method_ratio,
        morning_session_ratio,
        total_sessions,
    ])
    labels.append(label)

X = np.array(rows, dtype=float)
y = np.array(labels, dtype=int)

print(f"Feature matrix shape: {X.shape}")

at_risk_count = int(y.sum())
safe_count    = len(y) - at_risk_count
print(f"At-risk in dataset: {at_risk_count}")
print(f"Safe in dataset:    {safe_count}")

if len(y) < 10:
    print(f"WARNING: Only {len(y)} samples — need at least 10 to train reliably. "
          "Run seedHistoricalData.js to generate more data.")
    sys.exit(1)

# ── Step 5: Train ─────────────────────────────────────────────────────────────

print("\nTraining logistic regression...")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y if at_risk_count >= 2 and safe_count >= 2 else None
)

# Add Gaussian noise to training features to prevent the model from memorising
# the hard attendance_pct < 75 boundary. Noise std is ~25% of each feature's
# std, which blurs the decision surface and produces realistic intermediate
# probabilities without distorting the underlying behavioral signal.
rng = np.random.default_rng(42)
noise_std = np.std(X_train, axis=0) * 0.25
X_train_noisy = X_train + rng.normal(0, noise_std, X_train.shape)

# Flip ~15% of training labels to force probabilistic uncertainty near the
# decision boundary — prevents the model from learning a perfectly hard cliff.
flip_mask = rng.random(len(y_train)) < 0.15
y_train_noisy = y_train.copy()
y_train_noisy[flip_mask] = 1 - y_train_noisy[flip_mask]

model = LogisticRegression(max_iter=1000, random_state=42, C=0.1)
model.fit(X_train_noisy, y_train_noisy)

y_pred = model.predict(X_test)

accuracy  = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred, zero_division=0)
recall    = recall_score(y_test, y_pred, zero_division=0)
cm        = confusion_matrix(y_test, y_pred)

print(f"\nTest Accuracy:  {accuracy:.2f}")
print(f"Test Precision: {precision:.2f}")
print(f"Test Recall:    {recall:.2f}")
print(f"Confusion Matrix:\n{cm}")

print("\nFeature Coefficients:")
for name, coef in zip(FEATURE_NAMES, model.coef_[0]):
    print(f"  {name}: {coef:.4f}")

# ── Step 6: Save model and feature list ──────────────────────────────────────

with open(MODEL_PATH, "wb") as f:
    pickle.dump(model, f)
print(f"\nModel saved to {MODEL_PATH}")

with open(FEATURES_PATH, "w") as f:
    json.dump(FEATURE_NAMES, f, indent=2)
print(f"Features saved to {FEATURES_PATH}")

print("\nTraining complete.")
client.close()
