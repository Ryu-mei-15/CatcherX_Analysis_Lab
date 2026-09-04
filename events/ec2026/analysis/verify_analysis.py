#!/usr/bin/env python3
"""生成済み公開データの主要な不変条件を検証する．"""

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT.parent / "data" / "public"
EXPECTED_PLAYERS = ["Player 1", "Player 2", "Player 3", "Player 5", "Player 6", "Player 7"]


def close(left, right, tolerance=1e-8):
    return math.isclose(left, right, rel_tol=tolerance, abs_tol=tolerance)


def main():
    records = json.loads((PUBLIC_DIR / "data.json").read_text(encoding="utf-8"))
    summary = json.loads((PUBLIC_DIR / "analysis-summary.json").read_text(encoding="utf-8"))

    assert len(records) == summary["quality"]["raw_n"]
    assert sum(row["analysis_eligible"] for row in records) == summary["quality"]["eligible_n"]
    assert sum(row["extreme_coordinate_anomaly"] for row in records) == summary["quality"]["excluded_n"]
    assert [row["label"] for row in summary["by_player"]] == EXPECTED_PLAYERS
    assert summary["phase3_diversity"]["implemented_unique_pitch_types"] == 34

    for row in records:
        # actual - required = catch - impact = residual
        for axis in "xyz":
            actual = row[f"movement_{axis}_cm"]
            required = row[f"required_{axis}_cm"]
            residual = row[f"residual_{axis}_cm"]
            assert close(actual - required, residual), row["record_id"]
        cosine = row["direction_cosine_3d"]
        assert cosine is None or -1.0 <= cosine <= 1.0

    assert summary["quality"]["logged_movement_mean_abs_difference_cm"] < 0.1
    assert summary["quality"]["published_trial_count"] == 1946
    assert summary["quality"]["eligible_n"] == 1948

    print("検証完了")
    print(f"  元ログ: {len(records):,}件")
    print(f"  再分析対象: {summary['quality']['eligible_n']:,}件")
    print(f"  除外フラグ: {summary['quality']['excluded_n']:,}件")
    print(f"  実装球種: {summary['phase3_diversity']['implemented_unique_pitch_types']}種")


if __name__ == "__main__":
    main()
