"""Compare new agent runs (larger model, repeated runs) with the original ablation (prefix 'abl').

Usage (from raqa/):
  python3 -I scripts/compare_runs.py abl q14 abl-r2 abl-r3 [--ref abl] [--out runs/compare-report.md]

For each run prefix it reports, per configuration (A0, A1, A2, A3, A6, A7):
  - completed scenarios (automatic TSR), number of step occurrences
  - self-referential steps (c_t = 0 while c_act, c_loc, c_orc are all > 0) and their share
  - whether c_act and c_orc vary inside the configuration, and the distinct values of c_t
  - gate decisions (auto / reviewer / audit)
  - how many step occurrences already have human labels in the original rating (same scenario + identical step),
    i.e. how many NEW unique steps would still need rating
For prefixes that share configurations with the reference prefix it also reports run-to-run stability:
  - same verdict per scenario, identical trace (same sequence of steps) per scenario.
Nothing here needs human labels; it only reads runs/<prefix>-<config>/results.json.
"""
import json, os, sys, collections

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = {sys.argv[i]: sys.argv[i + 1] for i in range(1, len(sys.argv) - 1) if sys.argv[i].startswith("--")}
REF = opt.get("--ref", "abl")
OUT = opt.get("--out", "runs/compare-report.md")
RUNS = "runs"
CONFIGS = ["A0", "A1", "A2", "A3", "A6", "A7"]

def fp(s):
    return json.dumps([s.get("type"), s.get("role"), s.get("name"), s.get("attribute"), s.get("value"), s.get("pattern"), s.get("path")])

def load(prefix, cfg):
    p = os.path.join(RUNS, f"{prefix}-{cfg}", "results.json")
    return json.load(open(p)) if os.path.exists(p) else None

# steps that already carry human labels (original rating key)
rated = set()
key_path = os.path.join("review", "KEY-jangan-dibagikan.json")
if os.path.exists(key_path):
    key = json.load(open(key_path))
    for it in key["steps"]:
        for o in it["occurrences"]:
            res = load(key["prefix"], o["configId"])
            if res is None: continue
            r = next(x for x in res if x["id"] == it["scenarioId"])
            rated.add((it["scenarioId"], fp(r["trace"][o["stepIndex"] - 1])))

lines = ["# Comparison of agent runs", "", f"Reference prefix: `{REF}`. Rated-step key: {len(rated)} labelled (scenario, step) pairs.", ""]
lines += ["| Prefix | Config | Done/17 | Steps | Self-ref (share) | c_act varies | c_orc varies | Distinct c_t | Gate auto/reviewer/audit | Steps already rated | New unique steps |",
          "|---|---|---|---|---|---|---|---|---|---|---|"]
for prefix in args:
    for cfg in CONFIGS:
        res = load(prefix, cfg)
        if res is None: continue
        occ = [(r["id"], t) for r in res for t in r["trace"]]
        sr = sum(1 for _, t in occ if t["scores"]["c_t"] == 0 and min(t["scores"]["c_act"], t["scores"]["c_loc"], t["scores"]["c_orc"]) > 0)
        acts = {t["scores"]["c_act"] for _, t in occ}; orcs = {t["scores"]["c_orc"] for _, t in occ}
        cts = sorted({round(t["scores"]["c_t"], 3) for _, t in occ})
        g = collections.Counter(t["gate"] for _, t in occ)
        have = sum(1 for sid, t in occ if (sid, fp(t)) in rated)
        new_unique = len({(sid, fp(t)) for sid, t in occ if (sid, fp(t)) not in rated})
        done = sum(1 for r in res if r["done"])
        share = f"{sr} ({100 * sr / len(occ):.0f}%)" if occ else "0"
        lines.append(f"| {prefix} | {cfg} | {done} | {len(occ)} | {share} | {'yes' if len(acts) > 1 else 'no'} | {'yes' if len(orcs) > 1 else 'no'} | {cts} | {g.get('auto', 0)}/{g.get('reviewer', 0)}/{g.get('audit', 0)} | {have}/{len(occ)} | {new_unique} |")

lines += ["", "## Run-to-run stability against the reference", "", "| Prefix | Config | Same verdict | Identical trace |", "|---|---|---|---|"]
for prefix in args:
    if prefix == REF: continue
    for cfg in CONFIGS:
        a, b = load(REF, cfg), load(prefix, cfg)
        if a is None or b is None: continue
        A = {r["id"]: r for r in a}; B = {r["id"]: r for r in b}; ids = sorted(set(A) & set(B))
        same_v = sum(A[i]["verdict"] == B[i]["verdict"] for i in ids)
        same_t = sum([fp(t) for t in A[i]["trace"]] == [fp(t) for t in B[i]["trace"]] for i in ids)
        lines.append(f"| {prefix} | {cfg} | {same_v}/{len(ids)} | {same_t}/{len(ids)} |")
open(OUT, "w").write("\n".join(lines) + "\n")
print("\n".join(lines)); print(f"\nWritten: {OUT}")
