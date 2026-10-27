"""Writes appendix/example_traces.md: one successful and one failed trace from A0, showing input, scores,
gate decision, stub response, execution and final verdict.  Run from this folder."""
import json, csv, collections
key = json.load(open("../raqa/review/KEY-jangan-dibagikan.json"))
cat = {s["id"]: s for s in json.load(open("../scenarios/catalog.json"))["scenarios"]}
ST = {k: {r["item_id"]: r for r in csv.DictReader(open(f"../raqa/review/step-ratings-{k}.csv", encoding="utf-8-sig"))} for k in ("R1", "R2", "R3")}
item = {(o["label"], it["scenarioId"], o["stepIndex"]): it["itemId"] for it in key["steps"] for o in it["occurrences"]}
runs = {r["id"]: r for r in json.load(open("../raqa/runs/abl-A0/results.json"))}
out = ["# Example traces (configuration A0)", "",
       "Generated from raqa/runs/abl-A0/results.json and the anonymised ratings. Gate rule: auto-accept if c_t >= 0.8; "
       "escalations and audits are answered by the stub (accept if c_t >= 0.6, otherwise reject).", ""]
for title, sid in (("Trace 1: successful scenario", "S-HOME-01"), ("Trace 2: failed scenario (self-referential step)", "S-HOME-06")):
    r = runs[sid]; c = cat[sid]
    out += [f"## {title}: {sid}", "", f"- Goal: {c['goal']}", "- Acceptance criteria: " + "; ".join(c["acceptance_criteria"]), ""]
    for i, t in enumerate(r["trace"], 1):
        iid = item.get(("abl-A0", sid, i)); votes = [ST[k][iid]["R3_decision_accept_edit_reject"] for k in ST] if iid else []
        out += [f"### Step {i}",
                f"- Proposed step: {t['type']} role={t.get('role')} name=\"{t.get('name')}\" attribute={t.get('attribute')} value=\"{t.get('value')}\"",
                f"- Cited units: {', '.join(t.get('citedUnits') or []) or '(none)'}",
                f"- Scores: c_act={t['scores']['c_act']}, c_loc={t['scores']['c_loc']}, c_orc={t['scores']['c_orc']}, c_t={t['scores']['c_t']}",
                f"- Gate decision: {t['gate']}" + ("" if t["gate"] == "auto" else f"; stub answer: {t.get('decision')}"),
                f"- Accepted into trace: {t.get('accepted')}; execution failed: {t.get('executionFailed')}",
                f"- Rating item {iid}: decisions by raters R1/R2/R3 = {votes}", ""]
    out += [f"- Final: done={r['done']}, verdict={r['verdict']}, error={r.get('error')}", ""]
open("../appendix/example_traces.md", "w", encoding="utf-8").write("\n".join(out)); print("\n".join(out))
