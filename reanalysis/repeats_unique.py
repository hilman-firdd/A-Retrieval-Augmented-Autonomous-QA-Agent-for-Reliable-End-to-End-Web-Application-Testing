"""Robustness runs (three Qwen3 4B repetitions, three Qwen3 8B repetitions): objective measures and, for 4B, gate
agreement on UNIQUE labelled steps (same unit as Table IV of the manuscript).
Run from the repository root:  python3 -I reanalysis/repeats_unique.py . reanalysis/repeats_unique.json

A step of a repeat run carries a human label only if the same scenario contains an identical step (same type, role,
name, attribute, value, pattern, path) that the three raters already rated. No new ratings are created here.
Scenarios stopped by an infrastructure error (start page did not load) are excluded from the success counts."""
import sys, os, json, csv, collections

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
OUTP = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "reanalysis", "repeats_unique.json")
RQ = os.path.join(ROOT, "raqa")
CONFIGS = ["A0", "A1", "A2", "A3", "A6", "A7"]
RETRIEVAL = ["A0", "A2", "A3", "A6", "A7"]
MODELS = {"qwen3:4b": ["abl", "abl4b-r2", "abl4b-r3"], "qwen3:8b": ["abl8b-r1", "abl8b-r2", "abl8b-r3"]}
TAU = 0.8

def fp(s):
    return json.dumps([s.get("type"), s.get("role"), s.get("name"), s.get("attribute"), s.get("value"), s.get("pattern"), s.get("path")])
def load(label):
    return json.load(open(os.path.join(RQ, "runs", label, "results.json")))

key = json.load(open(os.path.join(RQ, "review", "KEY-jangan-dibagikan.json")))
R = {k: {r["item_id"]: r["R3_decision_accept_edit_reject"].strip().lower()
         for r in csv.DictReader(open(os.path.join(RQ, "review", f"step-ratings-{k}.csv"), encoding="utf-8-sig"))}
     for k in ("R1", "R2", "R3")}
def majority(item):
    c = collections.Counter(R[k][item] for k in R); best = max(c.values()); top = [x for x in c if c[x] == best]
    return top[0] if len(top) == 1 and best >= 2 else None
label = {}
for it in key["steps"]:
    o = it["occurrences"][0]
    run = {s["id"]: s for s in load(o["label"])}[it["scenarioId"]]
    label[(it["scenarioId"], fp(run["trace"][o["stepIndex"] - 1]))] = majority(it["itemId"])

def kappa(pairs):  # pairs of (gate_auto_accepts, human_accepts); positive class = human did not accept
    tp = sum((not a) and (not h) for a, h in pairs); fn = sum(a and (not h) for a, h in pairs)
    fp_ = sum((not a) and h for a, h in pairs); tn = sum(a and h for a, h in pairs); n = len(pairs)
    po = (tp + tn) / n; pe = ((tp + fp_) / n) * ((tp + fn) / n) + ((tn + fn) / n) * ((tn + fp_) / n)
    return dict(n=n, tp=tp, fn=fn, fp=fp_, tn=tn, kappa=round((po - pe) / (1 - pe), 3) if pe < 1 else None,
                auto_err=f"{fn}/{tn + fn}")

OUT = {}
for model, prefixes in MODELS.items():
    m = {"success": {}, "infra_errors": 0, "completions": collections.Counter(), "s_auth_03": [], "signals": {}}
    steps = []
    for p in prefixes:
        for c in CONFIGS:
            res = load(f"{p}-{c}")
            ok = [s for s in res if not s.get("infraError")]
            m["infra_errors"] += len(res) - len(ok)
            m["success"].setdefault(c, []).append(f"{sum(s['done'] for s in ok)}/{len(ok)}")
            for s in res:
                if s["done"]:
                    m["completions"]["repeated-step rule" if any("auto-done" in (t.get("note") or "") for t in s["trace"]) else "planner done flag"] += 1
                if s["id"] == "S-AUTH-03" and c in RETRIEVAL:
                    m["s_auth_03"].append(dict(run=f"{p}-{c}", verdict=s["verdict"], done=s["done"]))
                if c in RETRIEVAL:
                    steps += [(s["id"], t) for t in s["trace"]]
    sc = lambda t: t["scores"]
    selfref = lambda t: sc(t)["c_t"] == 0 and min(sc(t)["c_act"], sc(t)["c_loc"], sc(t)["c_orc"]) > 0
    n = len(steps)
    m["signals"] = dict(steps=n, self_referential=sum(selfref(t) for _, t in steps),
                        auto_accepted=sum(t["gate"] == "auto" for _, t in steps),
                        c_act_values=sorted({sc(t)["c_act"] for _, t in steps}), c_orc_values=sorted({sc(t)["c_orc"] for _, t in steps}),
                        c_loc_below_tau=sum(sc(t)["c_loc"] < TAU for _, t in steps))
    m["s_auth_03_declared_pass"] = f"{sum(x['verdict'] == 'PASS' for x in m['s_auth_03'])}/{len(m['s_auth_03'])}"
    m["completions"] = dict(m["completions"])
    uniq = {}
    for sid, t in steps:
        uniq.setdefault((sid, fp(t)), t)
    lab = [(k, t) for k, t in uniq.items() if label.get(k) is not None]
    m["unique_steps"] = dict(total=len(uniq), already_rated=sum(k in label for k in uniq), with_majority=len(lab),
                             not_yet_rated=sum(k not in label for k in uniq))
    if lab:
        human = lambda k: label[k] == "accept"
        m["gate_unique_labelled"] = {
            "full gate": kappa([(sc(t)["c_t"] >= TAU, human(k)) for k, t in lab]),
            "three signals without the rule": kappa([(min(sc(t)["c_act"], sc(t)["c_loc"], sc(t)["c_orc"]) >= TAU, human(k)) for k, t in lab]),
            "self-referential rule only": kappa([(not selfref(t), human(k)) for k, t in lab]),
        }
    OUT[model] = m

json.dump(OUT, open(OUTP, "w"), indent=1)
print(json.dumps(OUT, indent=1))
