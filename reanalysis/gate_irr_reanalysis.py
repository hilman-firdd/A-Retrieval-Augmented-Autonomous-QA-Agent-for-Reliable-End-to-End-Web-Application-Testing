"""Reanalysis of RAQA gate and IRR from the frozen repo data (commit 36cdc96).
Run: python3 -I reanalysis.py /home/claude/rr/repo
Every number printed here comes from files in the repo; nothing is simulated except the
explicitly labelled random-escalation baseline (exact hypergeometric, no sampling)."""
import sys, json, csv, itertools, math, collections
from math import comb
import numpy as np
import krippendorff
from statsmodels.stats.proportion import proportion_confint
from statsmodels.stats.inter_rater import fleiss_kappa, aggregate_raters

ROOT = sys.argv[1]
RV = f"{ROOT}/raqa/review"
RUNS = f"{ROOT}/raqa/runs"
OUT = {}

def read_csv(p):
    with open(p, encoding="utf-8-sig") as f:
        return {r["item_id"]: r for r in csv.DictReader(f)}

norm = lambda v: (v or "").strip().lower() or None
raters = {k: read_csv(f"{RV}/step-ratings-{k}.csv") for k in ("R1", "R2", "R3")}
key = json.load(open(f"{RV}/KEY-jangan-dibagikan.json"))
items = [s["itemId"] for s in key["steps"]]

DEC = {"accept": 0, "edit": 1, "reject": 2}
def dec(r, i): return DEC.get(norm(raters[r][i]["R3_decision_accept_edit_reject"])) if i in raters[r] else None
def rel(r, i):
    v = norm(raters[r][i]["R1_relevance_0_1_2"]) if i in raters[r] else None
    return int(v) if v in ("0", "1", "2") else None
def cor(r, i):
    v = norm(raters[r][i]["R2_correct_yes_no_unsure"]) if i in raters[r] else None
    return {"yes": 1, "no": 0}.get(v)  # 'unsure' -> missing, as in analyze-hitl.js

def majority(vals):
    v = [x for x in vals if x is not None]
    if not v: return None
    c = collections.Counter(v); best = max(c.values()); top = [k for k in c if c[k] == best]
    return top[0] if len(top) == 1 and best > len(v) / 2 else None

R = ("R1", "R2", "R3")
D = np.array([[dec(r, i) if dec(r, i) is not None else np.nan for i in items] for r in R], float)
Rel = np.array([[rel(r, i) if rel(r, i) is not None else np.nan for i in items] for r in R], float)
Cor = np.array([[cor(r, i) if cor(r, i) is not None else np.nan for i in items] for r in R], float)
Bin = np.where(np.isnan(D), np.nan, (D == 0).astype(float))  # accept vs not-accept

def boot_alpha(data, level, B=2000, seed=11):
    rng = np.random.default_rng(seed); n = data.shape[1]; out = []
    for _ in range(B):
        idx = rng.integers(0, n, n)
        try: out.append(krippendorff.alpha(reliability_data=data[:, idx], level_of_measurement=level))
        except Exception: pass
    return np.nanpercentile(out, [2.5, 97.5]).tolist()

def gwet_ac1(data):
    """Gwet AC1 for multiple raters, nominal, items with >=2 ratings (Gwet 2008, eq. for multiple raters)."""
    cats = sorted({int(x) for x in data[~np.isnan(data)]}); q = len(cats)
    cols = [data[:, j] for j in range(data.shape[1])]
    cols = [c[~np.isnan(c)] for c in cols if np.sum(~np.isnan(c)) >= 2]
    pa = np.mean([sum(np.sum(c == k) * (np.sum(c == k) - 1) for k in cats) / (len(c) * (len(c) - 1)) for c in cols])
    pik = [np.mean([np.sum(c == k) / len(c) for c in cols]) for k in cats]
    pe = sum(p * (1 - p) for p in pik) / (q - 1)
    return (pa - pe) / (1 - pe), pa, pe, len(cols)

def boot_ac1(data, B=2000, seed=11):
    rng = np.random.default_rng(seed); n = data.shape[1]
    vals = [gwet_ac1(data[:, rng.integers(0, n, n)])[0] for _ in range(B)]
    return np.percentile(vals, [2.5, 97.5]).tolist()

irr = {}
for name, data, lvl in [("relevance", Rel, "ordinal"), ("decision3", D, "nominal"), ("correct", Cor, "nominal"), ("accept_binary", Bin, "nominal")]:
    a = krippendorff.alpha(reliability_data=data, level_of_measurement=lvl)
    irr[name] = {"alpha": round(a, 3), "alpha_ci": [round(x, 3) for x in boot_alpha(data, lvl)]}
    if lvl == "nominal":
        ac1, pa, pe, n = gwet_ac1(data)
        irr[name].update({"ac1": round(ac1, 3), "ac1_ci": [round(x, 3) for x in boot_ac1(data)], "pa": round(pa, 3), "pe_gwet": round(pe, 3), "n": n})
full = ~np.isnan(D).any(axis=0)
tab, _ = aggregate_raters(D[:, full].T.astype(int))
irr["decision3"]["fleiss_kappa_complete"] = round(fleiss_kappa(tab), 3)
irr["decision3"]["n_complete"] = int(full.sum())
# pairwise raw agreement and Cohen kappa on decision
def cohen(a, b):
    m = ~np.isnan(a) & ~np.isnan(b); a, b = a[m], b[m]; cats = sorted(set(a) | set(b))
    po = np.mean(a == b); pe = sum(np.mean(a == k) * np.mean(b == k) for k in cats)
    return (po - pe) / (1 - pe) if pe < 1 else float("nan"), po, int(m.sum())
irr["pairwise_decision"] = {f"{x}-{y}": dict(zip(("kappa", "raw", "n"), [round(v, 3) if isinstance(v, float) else v for v in cohen(D[i], D[j])])) for (i, x), (j, y) in itertools.combinations(enumerate(R), 2)}
irr["pairwise_accept_binary"] = {f"{x}-{y}": dict(zip(("kappa", "raw", "n"), [round(v, 3) if isinstance(v, float) else v for v in cohen(Bin[i], Bin[j])])) for (i, x), (j, y) in itertools.combinations(enumerate(R), 2)}
irr["marginals_decision"] = {r: {k: int(np.sum(D[n] == v)) for k, v in DEC.items()} for n, r in enumerate(R)}
OUT["irr"] = irr

# ---------- per-occurrence join with run traces (component scores) ----------
traces = {}
for lab in key["labels"]:
    for s in json.load(open(f"{RUNS}/{lab}/results.json")):
        for k, t in enumerate(s["trace"], 1):
            traces[(lab, s["id"], k)] = t
occ = []
for it in key["steps"]:
    i = items.index(it["itemId"])
    md = majority([None if np.isnan(x) else int(x) for x in D[:, i]])
    for o in it["occurrences"]:
        t = traces[(o["label"], it["scenarioId"], o["stepIndex"])]
        sc = t["scores"]
        selfref = (sc["c_t"] == 0 and min(sc["c_act"], sc["c_loc"], sc["c_orc"]) > 0)
        occ.append(dict(item=it["itemId"], cfg=o["configId"], scen=it["scenarioId"], step=o["stepIndex"], gate=t["gate"],
                        c_act=sc["c_act"], c_loc=sc["c_loc"], c_orc=sc["c_orc"], c_t=sc["c_t"], selfref=selfref,
                        type=t["type"], majority=md, human_ok=None if md is None else int(md == 0)))
assert all(abs(o["c_t"] - (0 if o["selfref"] else min(o["c_act"], o["c_loc"], o["c_orc"]))) < 1e-9 for o in occ)
OUT["n_occurrences"] = len(occ)
OUT["signal_variation"] = {c: {"c_act_values": sorted({o["c_act"] for o in occ if o["cfg"] == c}),
                              "c_orc_values": sorted({o["c_orc"] for o in occ if o["cfg"] == c}),
                              "c_loc_values": sorted({round(o["c_loc"], 3) for o in occ if o["cfg"] == c}),
                              "selfref_n": sum(o["selfref"] for o in occ if o["cfg"] == c),
                              "n": sum(1 for o in occ if o["cfg"] == c),
                              "gate_counts": dict(collections.Counter(o["gate"] for o in occ if o["cfg"] == c))} for c in sorted({o["cfg"] for o in occ})}

TAU = 0.8
def eval_gate(rows, conf_fn, tau=TAU):
    """gate auto-accepts iff conf >= tau. Positive class = human did NOT accept. Audit draws are ignored:
    an audited step is scored by what the gate itself decided (c_t >= tau -> auto)."""
    r = [x for x in rows if x["human_ok"] is not None]
    auto = [conf_fn(x) >= tau for x in r]; ok = [x["human_ok"] == 1 for x in r]
    tp = sum((not a) and (not h) for a, h in zip(auto, ok)); fn = sum(a and (not h) for a, h in zip(auto, ok))
    fp = sum((not a) and h for a, h in zip(auto, ok)); tn = sum(a and h for a, h in zip(auto, ok))
    n = len(r); po = (tp + tn) / n
    pe = ((tp + fp) / n) * ((tp + fn) / n) + ((tn + fn) / n) * ((tn + fp) / n)
    kap = (po - pe) / (1 - pe) if pe < 1 else None
    cp = lambda k, m: [round(x, 3) for x in proportion_confint(k, m, method="beta")] if m else None
    wl = lambda k, m: [round(x, 3) for x in proportion_confint(k, m, method="wilson")] if m else None
    return dict(n=n, tp=tp, fn=fn, fp=fp, tn=tn, kappa=None if kap is None else round(kap, 3),
                coverage=round((tn + fn) / n, 3), esc_recall=None if tp + fn == 0 else round(tp / (tp + fn), 3),
                esc_recall_wilson=wl(tp, tp + fn), esc_recall_cp=cp(tp, tp + fn),
                auto_err=None if tn + fn == 0 else round(fn / (tn + fn), 3), auto_err_wilson=wl(fn, tn + fn), auto_err_cp=cp(fn, tn + fn),
                esc_precision=None if tp + fp == 0 else round(tp / (tp + fp), 3))

gates = {
    "full (as implemented)": lambda x: x["c_t"],
    "min(c_act,c_loc,c_orc), no self-ref rule": lambda x: min(x["c_act"], x["c_loc"], x["c_orc"]),
    "c_act only": lambda x: x["c_act"],
    "c_loc only": lambda x: x["c_loc"],
    "c_orc only": lambda x: x["c_orc"],
    "self-ref rule only": lambda x: 0 if x["selfref"] else 1,
    "self-ref rule + c_loc": lambda x: 0 if x["selfref"] else x["c_loc"],
    "accept all": lambda x: 1,
    "escalate all": lambda x: 0,
}
sets = {"A0": [o for o in occ if o["cfg"] == "A0"],
        "pooled A0,A2,A3,A6,A7 (occurrences)": [o for o in occ if o["cfg"] != "A1"]}
OUT["gate_variants"] = {s: {g: eval_gate(rows, f) for g, f in gates.items()} for s, rows in sets.items()}

# legacy definition used in analyze-hitl.js: 'audit' counted as escalated
a0 = [o for o in sets["A0"] if o["human_ok"] is not None]
OUT["A0_legacy_audit_as_escalated"] = {"auto": sum(o["gate"] == "auto" for o in a0), "escalated": sum(o["gate"] != "auto" for o in a0),
                                       "audited_items": [(o["item"], o["human_ok"]) for o in sets["A0"] if o["gate"] == "audit"],
                                       "no_majority_items": [(o["item"], o["gate"]) for o in sets["A0"] if o["human_ok"] is None]}

# budget-matched random escalation: P(random set of size E catches all B non-accepted among N)
def hyper_all(N, B, E):
    return comb(N - B, E - B) / comb(N, E) if E >= B else 0.0
def hyper_ge(N, B, E, k):  # P(X >= k), X = non-accepted caught
    return sum(comb(B, j) * comb(N - B, E - j) for j in range(k, min(B, E) + 1)) / comb(N, E)
rb = {}
for s, rows in sets.items():
    g = eval_gate(rows, gates["full (as implemented)"])
    N = g["n"]; B = g["tp"] + g["fn"]; E = g["tp"] + g["fp"]
    rb[s] = dict(N=N, non_accepted=B, escalated=E, caught=g["tp"], p_random_catch_ge_observed=hyper_ge(N, B, E, g["tp"]),
                 expected_caught_random=round(E * B / N, 2))
OUT["random_budget_matched"] = rb

# tau sweep (decisions only change at distinct c_t values)
OUT["distinct_c_t"] = {s: sorted({round(o["c_t"], 3) for o in rows}) for s, rows in sets.items()}
OUT["tau_sweep"] = {s: {t: {k: v for k, v in eval_gate(rows, gates["full (as implemented)"], t).items() if k in ("coverage", "tp", "fn", "fp", "tn", "kappa", "auto_err")}
                        for t in (0.05, 0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0)} for s, rows in sets.items()}

# risk-coverage: sort by c_t desc, accept top-k; risk = share not accepted among accepted
def risk_cov(rows):
    r = sorted([x for x in rows if x["human_ok"] is not None], key=lambda x: -x["c_t"])
    pts = []; thresholds = sorted({x["c_t"] for x in r}, reverse=True)
    for th in thresholds:
        acc = [x for x in r if x["c_t"] >= th]
        pts.append(dict(threshold=round(th, 3), coverage=round(len(acc) / len(r), 3), risk=round(sum(1 - x["human_ok"] for x in acc) / len(acc), 3), n_acc=len(acc)))
    # AURC over stepwise curve with ties broken arbitrarily is ill-defined; report points only
    return pts
OUT["risk_coverage"] = {s: risk_cov(rows) for s, rows in sets.items()}

# escalation cause breakdown (A0 and pooled) vs human outcome
def cause(o):
    if o["c_act"] < TAU: return "c_act"
    if o["selfref"]: return "self-ref"
    if o["c_loc"] < TAU: return "c_loc"
    if o["c_orc"] < TAU: return "c_orc"
    return "none (c_t>=tau)"
OUT["cause_vs_human"] = {s: {c: dict(collections.Counter("accept" if o["human_ok"] == 1 else ("not-accept" if o["human_ok"] == 0 else "no-majority") for o in rows if cause(o) == c))
                             for c in ("c_act", "self-ref", "c_loc", "c_orc", "none (c_t>=tau)")} for s, rows in {**sets, "A1": [o for o in occ if o["cfg"] == "A1"]}.items()}
OUT["selfref_types"] = dict(collections.Counter(o["type"] for o in occ if o["selfref"]))

json.dump(OUT, open(sys.argv[2] if len(sys.argv) > 2 else "reanalysis.json", "w"), indent=1, default=str)
print(json.dumps(OUT, indent=1, default=str))

# ---- unique-item view (each rated item counted once; conflict if gate decisions differ across configs) ----
by_item = collections.defaultdict(list)
for o in occ:
    if o["cfg"] != "A1": by_item[o["item"]].append(o)
uniq = []; conflicts = 0
for it, os_ in by_item.items():
    if len({o["c_t"] >= TAU for o in os_}) > 1: conflicts += 1
    uniq.append(os_[0])
U = {g: eval_gate(uniq, f) for g, f in gates.items() if g in ("full (as implemented)", "min(c_act,c_loc,c_orc), no self-ref rule", "self-ref rule only", "accept all")}
# scenario-cluster bootstrap CI for kappa (unique items)
rng = np.random.default_rng(7)
scen = sorted({o["scen"] for o in uniq if o["human_ok"] is not None})
def kap(rows, f):
    return eval_gate(rows, f)["kappa"]
bs = {g: [] for g in U}
for _ in range(2000):
    pick = rng.choice(scen, len(scen), replace=True)
    rows = [o for s in pick for o in uniq if o["scen"] == s]
    for g in U:
        k = kap(rows, gates[g]);
        if k is not None: bs[g].append(k)
print("UNIQUE items", len(uniq), "conflicts", conflicts)
for g, v in U.items():
    print(g, {k: v[k] for k in ("n", "tp", "fn", "fp", "tn", "kappa", "esc_recall", "auto_err", "auto_err_cp")}, "kappa cluster-CI", np.percentile(bs[g], [2.5, 97.5]).round(3) if bs[g] else None)
FIG = {"A0": {g: eval_gate(sets["A0"], f) for g, f in gates.items()}, "unique": {g: eval_gate(uniq, f) for g, f in gates.items()}}
json.dump(FIG, open("fig_data.json", "w"), indent=1)

# ---- Table IV of the manuscript: every gate variant on the 57 unique steps, plus the budget-matched random baseline ----
T4 = {}
for g in ("full (as implemented)", "self-ref rule only", "min(c_act,c_loc,c_orc), no self-ref rule", "c_loc only", "c_act only", "c_orc only", "accept all"):
    r = eval_gate(uniq, gates[g])
    T4[g] = dict(kappa=r["kappa"], esc_recall=f"{r['tp']}/{r['tp'] + r['fn']}", auto_err=f"{r['fn']}/{r['tn'] + r['fn']}",
                 auto_err_pct=None if r["auto_err"] is None else round(100 * r["auto_err"], 1),
                 auto_err_cp_pct=None if r["auto_err_cp"] is None else [round(100 * x, 1) for x in r["auto_err_cp"]],
                 coverage_pct=round(100 * r["coverage"], 1),
                 kappa_cluster_ci=(np.percentile(bs[g], [2.5, 97.5]).round(3).tolist() if g in bs and bs[g] else None))
g = eval_gate(uniq, gates["full (as implemented)"])
N, B, E = g["n"], g["tp"] + g["fn"], g["tp"] + g["fp"]
T4["random_budget_matched"] = dict(N=N, non_accepted=B, escalated=E, caught=g["tp"], p_random_catch_ge_observed=hyper_ge(N, B, E, g["tp"]))
T4["tau_sweep"] = {t: {k: v for k, v in eval_gate(uniq, gates["full (as implemented)"], t).items() if k in ("tp", "fn", "fp", "tn", "kappa", "coverage")}
                   for t in (0.05, 0.3, 0.5, 0.7, 0.8, 0.9, 0.925, 0.95, 1.0)}
T4["distinct_c_t"] = sorted({round(o["c_t"], 3) for o in uniq})
json.dump(T4, open("table_iv_unique.json", "w"), indent=1)
print("TABLE IV (unique steps):"); print(json.dumps(T4, indent=1))
