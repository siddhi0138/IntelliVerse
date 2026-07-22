"""V2: insight timeline — one note per period, grounded in what was
actually computed (a detected spike, a large period-over-period swing),
not a free-form narrative. Deliberately sparse: a quiet period gets no
entry rather than a fabricated one.
"""

from __future__ import annotations

from typing import Any

NOTABLE_DELTA_PCT = 15.0


def build_insight_timeline(
    monthly_series: list[dict[str, Any]],
    spikes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not monthly_series:
        return []

    spike_by_period = {s["period"]: s for s in spikes}
    timeline: list[dict[str, Any]] = []

    for i, point in enumerate(monthly_series):
        period = point["period"]
        notes: list[str] = []

        if period in spike_by_period:
            s = spike_by_period[period]
            notes.append(f"Anomaly detected: value {s['direction']} the trend line ({s['deviation_std']} sigma).")

        if i > 0:
            prev_value = monthly_series[i - 1]["value"]
            if prev_value != 0:
                delta_pct = round((point["value"] - prev_value) / abs(prev_value) * 100, 1)
                if abs(delta_pct) >= NOTABLE_DELTA_PCT:
                    direction = "increased" if delta_pct > 0 else "decreased"
                    notes.append(f"Value {direction} {abs(delta_pct)}% vs. the previous period.")

        if notes:
            timeline.append({"period": period, "value": point["value"], "notes": notes})

    return timeline
