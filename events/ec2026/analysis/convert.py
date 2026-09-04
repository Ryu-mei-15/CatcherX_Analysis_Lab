#!/usr/bin/env python3
"""CatcherX の公開用ログと再分析サマリを再生成する．

元のCSVは変更せず，data/raw/courseからdata/public内のJSONを生成する．
座標差はすべて同一座標系で計算し，距離は m から cm に換算する．
"""

from __future__ import annotations

import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parent
EVENT_ROOT = ROOT.parent
COURSE_DIR = EVENT_ROOT / "data" / "raw" / "course"
BREAK_DIR = EVENT_ROOT / "data" / "raw" / "phase"
PUBLIC_DIR = EVENT_ROOT / "data" / "public"
EXTREME_CONTROL_ERROR_CM = 50.0
DESIGNED_NOISE_RADIUS_CM = 25.0
EPSILON = 1e-12


def number(value, default=None):
    try:
        result = float(value)
        return result if math.isfinite(result) else default
    except (TypeError, ValueError):
        return default


def integer(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def vector(a, b):
    """a - b を cm で返す．"""
    return [(x - y) * 100.0 for x, y in zip(a, b)]


def norm(values, dimensions=3):
    return math.sqrt(sum(value * value for value in values[:dimensions]))


def directional_metrics(actual, required, dimensions):
    a = actual[:dimensions]
    r = required[:dimensions]
    actual_norm = norm(a, dimensions)
    required_norm = norm(r, dimensions)
    if actual_norm <= EPSILON or required_norm <= EPSILON:
        return {"cosine": None, "projection_ratio": None,
                "projected_distance_cm": None, "lateral_deviation_cm": None}
    dot = sum(x * y for x, y in zip(a, r))
    cosine = max(-1.0, min(1.0, dot / (actual_norm * required_norm)))
    projected = dot / required_norm
    lateral_sq = max(0.0, actual_norm * actual_norm - projected * projected)
    return {
        "cosine": cosine,
        "projection_ratio": dot / (required_norm * required_norm),
        "projected_distance_cm": projected,
        "lateral_deviation_cm": math.sqrt(lateral_sq),
    }


def classify_catch(result):
    text = str(result or "")
    if "PassedBall" in text:
        return "passed_ball"
    if "Missed" in text:
        return "missed"
    if "WildPitch" in text:
        return "wild_pitch"
    return "caught"


def mean(values):
    clean = [value for value in values if value is not None and math.isfinite(value)]
    return sum(clean) / len(clean) if clean else None


def median(values):
    clean = sorted(value for value in values if value is not None and math.isfinite(value))
    if not clean:
        return None
    mid = len(clean) // 2
    return clean[mid] if len(clean) % 2 else (clean[mid - 1] + clean[mid]) / 2


def percentile(values, probability):
    clean = sorted(value for value in values if value is not None and math.isfinite(value))
    if not clean:
        return None
    position = (len(clean) - 1) * probability
    lower, upper = math.floor(position), math.ceil(position)
    if lower == upper:
        return clean[lower]
    weight = position - lower
    return clean[lower] * (1 - weight) + clean[upper] * weight


def wilson(successes, total, z=1.959963984540054):
    if total == 0:
        return [None, None]
    p = successes / total
    denominator = 1 + z * z / total
    centre = (p + z * z / (2 * total)) / denominator
    half = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator
    return [max(0.0, centre - half), min(1.0, centre + half)]


def rank_auc(records, key, higher_is_success=True):
    """同順位を平均順位とする Mann–Whitney U 相当の AUC．"""
    pairs = [(row[key], 1 if row["is_caught"] else 0)
             for row in records if row.get(key) is not None]
    positives = sum(label for _, label in pairs)
    negatives = len(pairs) - positives
    if positives == 0 or negatives == 0:
        return None
    pairs.sort(key=lambda item: item[0])
    rank_sum = 0.0
    index = 0
    while index < len(pairs):
        end = index + 1
        while end < len(pairs) and pairs[end][0] == pairs[index][0]:
            end += 1
        average_rank = (index + 1 + end) / 2
        rank_sum += average_rank * sum(label for _, label in pairs[index:end])
        index = end
    auc = (rank_sum - positives * (positives + 1) / 2) / (positives * negatives)
    return auc if higher_is_success else 1 - auc


def pearson(xs, ys):
    pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    if len(pairs) < 2:
        return None
    mean_x = sum(x for x, _ in pairs) / len(pairs)
    mean_y = sum(y for _, y in pairs) / len(pairs)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in pairs)
    denominator = math.sqrt(sum((x - mean_x) ** 2 for x, _ in pairs) *
                            sum((y - mean_y) ** 2 for _, y in pairs))
    return numerator / denominator if denominator > EPSILON else None


def entropy(values):
    counts = Counter(values)
    total = sum(counts.values())
    return -sum((count / total) * math.log2(count / total)
                for count in counts.values()) if total else 0.0


def group_summary(rows, label):
    total = len(rows)
    caught = sum(row["is_caught"] for row in rows)
    return {
        "label": label,
        "n": total,
        "caught": caught,
        "catch_rate": caught / total if total else None,
        "catch_rate_ci95": wilson(caught, total),
        "mean_control_error_3d_cm": mean(row["control_error_3d_cm"] for row in rows),
        "mean_mitt_movement_3d_cm": mean(row["mitt_movement_3d_cm"] for row in rows),
        "median_mitt_movement_3d_cm": median(row["mitt_movement_3d_cm"] for row in rows),
        "mean_residual_error_3d_cm": mean(row["residual_error_3d_cm"] for row in rows),
        "median_residual_error_3d_cm": median(row["residual_error_3d_cm"] for row in rows),
        "median_direction_cosine_3d": median(row["direction_cosine_3d"] for row in rows),
        "median_projection_ratio_3d": median(row["projection_ratio_3d"] for row in rows),
    }


def read_course_data():
    records = []
    for path in sorted(COURSE_DIR.glob("*.csv")):
        parts = path.stem.split("_")
        if len(parts) != 2 or not all(part.isdigit() for part in parts):
            continue
        player_id, nominal_speed = parts
        with path.open(encoding="utf-8-sig", newline="") as handle:
            for source_row, row in enumerate(csv.DictReader(handle), start=2):
                target = [number(row.get(f"Target_Pos_{axis}")) for axis in "XYZ"]
                impact = [number(row.get(f"Impact_Pos_{axis}")) for axis in "XYZ"]
                start = [number(row.get(f"Mitt_Start_{axis}")) for axis in "XYZ"]
                catch = [number(row.get(f"Mitt_Catch_{axis}")) for axis in "XYZ"]
                if not all(value is not None for value in target + impact + start + catch):
                    continue
                control = vector(impact, target)
                actual = vector(catch, start)
                target_offset = vector(catch, target)
                residual = vector(catch, impact)
                required = vector(impact, start)
                direction_2d = directional_metrics(actual, required, 2)
                direction_3d = directional_metrics(actual, required, 3)
                control_2d, control_3d = norm(control, 2), norm(control, 3)
                movement_2d, movement_3d = norm(actual, 2), norm(actual, 3)
                category = classify_catch(row.get("Catch_Result"))
                outside_noise = control_3d > DESIGNED_NOISE_RADIUS_CM
                extreme = control_3d > EXTREME_CONTROL_ERROR_CM
                records.append({
                    "record_id": f"{path.stem}:{row.get('Pitch_Number', source_row - 1)}",
                    "source_file": path.name, "source_row": source_row,
                    "trial_id": row.get("Trial_ID", ""),
                    "pitch_number": integer(row.get("Pitch_Number")),
                    "condition_mode": row.get("Condition_Mode", ""),
                    "player_id": player_id, "player": f"Player {player_id}",
                    "speed_kmph": integer(nominal_speed), "speed": f"{nominal_speed} km/h",
                    "actual_speed_kmph": None,
                    "pitch_type": row.get("Selected_Pitch_Type", ""),
                    "course": row.get("Selected_Course_Zone", "Unknown"),
                    "batter_reaction": row.get("Batter_Reaction", ""),
                    "catch_result": row.get("Catch_Result", ""),
                    "catch_category": category, "is_caught": category == "caught",
                    "target_x": target[0], "target_y": target[1], "target_z": target[2],
                    "impact_x": impact[0], "impact_y": impact[1], "impact_z": impact[2],
                    "mitt_start_x": start[0], "mitt_start_y": start[1], "mitt_start_z": start[2],
                    "mitt_x": catch[0], "mitt_y": catch[1], "mitt_z": catch[2],
                    "control_x_cm": control[0], "control_y_cm": control[1], "control_z_cm": control[2],
                    "control_error_2d_cm": control_2d, "control_error_3d_cm": control_3d,
                    "movement_x_cm": actual[0], "movement_y_cm": actual[1], "movement_z_cm": actual[2],
                    "mitt_movement_2d_cm": movement_2d, "mitt_movement_3d_cm": movement_3d,
                    "logged_mitt_movement_cm": number(row.get("Mitt_Movement_Distance"), 0) * 100,
                    "target_offset_x_cm": target_offset[0], "target_offset_y_cm": target_offset[1],
                    "target_offset_z_cm": target_offset[2],
                    "target_offset_2d_cm": norm(target_offset, 2),
                    "target_offset_3d_cm": norm(target_offset, 3),
                    "residual_x_cm": residual[0], "residual_y_cm": residual[1],
                    "residual_z_cm": residual[2],
                    "residual_error_2d_cm": norm(residual, 2),
                    "residual_error_3d_cm": norm(residual, 3),
                    "required_x_cm": required[0], "required_y_cm": required[1],
                    "required_z_cm": required[2],
                    "required_movement_2d_cm": norm(required, 2),
                    "required_movement_3d_cm": norm(required, 3),
                    "direction_cosine_2d": direction_2d["cosine"],
                    "direction_cosine_3d": direction_3d["cosine"],
                    "projection_ratio_2d": direction_2d["projection_ratio"],
                    "projection_ratio_3d": direction_3d["projection_ratio"],
                    "projected_distance_2d_cm": direction_2d["projected_distance_cm"],
                    "projected_distance_3d_cm": direction_3d["projected_distance_cm"],
                    "lateral_deviation_2d_cm": direction_2d["lateral_deviation_cm"],
                    "lateral_deviation_3d_cm": direction_3d["lateral_deviation_cm"],
                    "outside_designed_noise": outside_noise,
                    "extreme_coordinate_anomaly": extreme,
                    "analysis_eligible": not extreme,
                    # 旧UIとの後方互換．補正量は構えから捕球までの移動量に統一する．
                    "diff_x_cm": target_offset[0], "diff_y_cm": target_offset[1],
                    "diff_z_cm": target_offset[2],
                    "correction_2d_cm": movement_2d, "correction_3d_cm": movement_3d,
                })
    return records


def build_phase3_summary():
    participants, pitch_catalog, course_catalog = [], Counter(), Counter()
    implemented_catalog = Counter()
    for path in sorted(BREAK_DIR.glob("*.csv")):
        with path.open(encoding="utf-8-sig", newline="") as handle:
            implemented_catalog.update(row["Selected_Pitch_Type"] for row in csv.DictReader(handle))
    for path in sorted(BREAK_DIR.glob("*_1_2.csv")):
        player_id = path.name.split("_")[0]
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        pitch_types = [row["Selected_Pitch_Type"] for row in rows]
        courses = [row["Selected_Course_Zone"] for row in rows]
        pitch_catalog.update(pitch_types)
        course_catalog.update(courses)
        transitions = max(0, len(rows) - 1)
        repeats = sum(a == b for a, b in zip(pitch_types, pitch_types[1:]))
        pitch_h = entropy(pitch_types)
        max_h = math.log2(len(set(pitch_types))) if len(set(pitch_types)) > 1 else 0
        participants.append({
            "player_id": player_id, "player": f"Player {player_id}", "n": len(rows),
            "unique_pitch_types": len(set(pitch_types)), "pitch_entropy_bits": pitch_h,
            "normalized_pitch_entropy": pitch_h / max_h if max_h else 0,
            "unique_courses": len(set(courses)), "course_entropy_bits": entropy(courses),
            "same_pitch_repeat_rate": repeats / transitions if transitions else None,
        })
    return {
        "n": sum(row["n"] for row in participants), "participants": participants,
        "unique_pitch_types": len(pitch_catalog),
        "pitch_catalog": [{"pitch_type": key, "n": value}
                          for key, value in pitch_catalog.most_common()],
        "implemented_unique_pitch_types": len(implemented_catalog),
        "implemented_pitch_catalog": [{"pitch_type": key, "n": value}
                                      for key, value in implemented_catalog.most_common()],
        "unique_courses": len(course_catalog),
    }


def build_summary(records):
    eligible = [row for row in records if row["analysis_eligible"]]
    by_player, by_speed, by_course, by_session = (defaultdict(list) for _ in range(4))
    for row in eligible:
        by_player[row["player"]].append(row)
        by_speed[row["speed"]].append(row)
        by_course[row["course"]].append(row)
        by_session[row["source_file"]].append(row)

    bins = [(-1.0, 0.0), (0.0, 0.5), (0.5, 0.8), (0.8, 0.9),
            (0.9, 0.95), (0.95, 1.0000001)]
    direction_bins = []
    for lower, upper in bins:
        selected = [row for row in eligible if row["direction_cosine_3d"] is not None
                    and lower <= row["direction_cosine_3d"] < upper]
        direction_bins.append(group_summary(selected, f"{lower:g}–{min(upper, 1):g}"))

    for rows in by_session.values():
        ordered = sorted(rows, key=lambda row: row["pitch_number"] or 0)
        for index, row in enumerate(ordered):
            row["session_tercile"] = min(2, (index * 3) // len(ordered)) + 1
    learning = [group_summary([row for row in eligible if row.get("session_tercile") == tercile],
                              f"{tercile}/3") for tercile in (1, 2, 3)]

    quality_by_player = []
    for player in sorted({row["player"] for row in records}):
        rows = [row for row in records if row["player"] == player]
        quality_by_player.append({
            "player": player, "raw_n": len(rows),
            "eligible_n": sum(row["analysis_eligible"] for row in rows),
            "outside_designed_noise_n": sum(row["outside_designed_noise"] for row in rows),
            "extreme_coordinate_anomaly_n": sum(row["extreme_coordinate_anomaly"] for row in rows),
        })

    caught_rows = [row for row in eligible if row["is_caught"]]
    failed_rows = [row for row in eligible if not row["is_caught"]]
    validation = {
        "direction_cosine_3d": {
            "caught_median": median(row["direction_cosine_3d"] for row in caught_rows),
            "failed_median": median(row["direction_cosine_3d"] for row in failed_rows),
            "auc": rank_auc(eligible, "direction_cosine_3d", True),
        },
        "projection_ratio_3d": {
            "caught_median": median(row["projection_ratio_3d"] for row in caught_rows),
            "failed_median": median(row["projection_ratio_3d"] for row in failed_rows),
            "auc": rank_auc(eligible, "projection_ratio_3d", True),
        },
        "residual_error_3d_cm": {
            "caught_median": median(row["residual_error_3d_cm"] for row in caught_rows),
            "failed_median": median(row["residual_error_3d_cm"] for row in failed_rows),
            "auc": rank_auc(eligible, "residual_error_3d_cm", False),
        },
        "magnitude_correlation": pearson(
            [row["required_movement_3d_cm"] for row in eligible],
            [row["mitt_movement_3d_cm"] for row in eligible]),
    }
    leave_one_out = []
    for player in sorted(by_player):
        subset = [row for row in eligible if row["player"] != player]
        leave_one_out.append({
            "excluded_player": player, "n": len(subset),
            "direction_cosine_auc": rank_auc(subset, "direction_cosine_3d", True),
            "residual_error_auc": rank_auc(subset, "residual_error_3d_cm", False),
        })

    logged_differences = [abs(row["mitt_movement_3d_cm"] - row["logged_mitt_movement_cm"])
                          for row in records]
    return {
        "schema_version": "2.0.0",
        "generated_from": "data/raw/course/*.csv and data/raw/phase/*_1_2.csv",
        "metric_scope": "3D unless otherwise stated",
        "quality": {
            "raw_n": len(records), "eligible_n": len(eligible),
            "excluded_n": len(records) - len(eligible),
            "designed_noise_radius_cm": DESIGNED_NOISE_RADIUS_CM,
            "outside_designed_noise_n": sum(row["outside_designed_noise"] for row in records),
            "extreme_threshold_cm": EXTREME_CONTROL_ERROR_CM,
            "extreme_coordinate_anomaly_n": sum(row["extreme_coordinate_anomaly"] for row in records),
            "control_error_p99_cm": percentile([row["control_error_3d_cm"] for row in records], 0.99),
            "control_error_max_cm": max(row["control_error_3d_cm"] for row in records),
            "actual_speed_missing_n": len(records), "actual_speed_missing_rate": 1.0,
            "logged_movement_mean_abs_difference_cm": mean(logged_differences),
            "logged_movement_max_abs_difference_cm": max(logged_differences),
            "published_trial_count": 1946,
            "published_vs_reanalysis_difference": len(eligible) - 1946,
            "by_player": quality_by_player,
        },
        "overall": group_summary(eligible, "全体"),
        "by_player": [group_summary(rows, player) for player, rows in sorted(by_player.items())],
        "by_speed": [group_summary(rows, speed) for speed, rows in sorted(by_speed.items())],
        "by_course": [group_summary(rows, course) for course, rows in sorted(by_course.items())],
        "catch_outcomes": dict(Counter(row["catch_category"] for row in eligible)),
        "direction_bins": direction_bins, "metric_validation": validation,
        "leave_one_player_out": leave_one_out, "learning_terciles": learning,
        "phase3_diversity": build_phase3_summary(),
        "definitions": {
            "control_error": "投球到達位置 − 投球目標位置",
            "mitt_movement": "捕球時ミット位置 − 構え位置",
            "residual_error": "捕球時ミット位置 − 投球到達位置",
            "required_movement": "投球到達位置 − 構え位置",
            "direction_cosine": "実移動ベクトルと必要移動ベクトルの正規化内積（−1〜1）",
            "projection_ratio": "必要移動方向への射影距離 ÷ 必要移動距離",
        },
    }


def main():
    records = read_course_data()
    summary = build_summary(records)
    with (PUBLIC_DIR / "data.json").open("w", encoding="utf-8") as handle:
        json.dump(records, handle, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    with (PUBLIC_DIR / "analysis-summary.json").open("w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2, allow_nan=False)
    print(f"data.json: {len(records):,} 件")
    print(f"analysis-summary.json: 再分析対象 {summary['quality']['eligible_n']:,} 件")


if __name__ == "__main__":
    main()
