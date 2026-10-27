"""Table III endpoints (pre-registered, correct-oracle, all criteria covered), accepted-step counts, and the
success-tracing table (appendix/verified_success_trace.csv).
Run from the package root:  python3 -I reanalysis/endpoints_and_trace.py ."""
import sys, json, csv, collections, os
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
RQ = os.path.join(ROOT, "raqa")
key = json.load(open(f"{RQ}/review/KEY-jangan-dibagikan.json"))
gt = json.load(open(f"{ROOT}/scenarios/ground-truth.json"))["expected"]
cat = {s["id"]: s for s in json.load(open(f"{ROOT}/scenarios/catalog.json"))["scenarios"]}
SR = {k: {r["item_id"]: r for r in csv.DictReader(open(f"{RQ}/review/scenario-ratings-{k}.csv", encoding="utf-8-sig"))} for k in ("R1", "R2", "R3")}
ST = {k: {r["item_id"]: r for r in csv.DictReader(open(f"{RQ}/review/step-ratings-{k}.csv", encoding="utf-8-sig"))} for k in ("R1", "R2", "R3")}
def maj(v):
    v = [x for x in v if x]; c = collections.Counter(v)
    if not c: return None
    b = max(c.values()); t = [k for k in c if c[k] == b]
    return t[0] if len(t) == 1 and b > len(v) / 2 else None
stepitem = {(o["label"], it["scenarioId"], o["stepIndex"]): it["itemId"] for it in key["steps"] for o in it["occurrences"]}
rows = []; tot = {}; acc = {}
for lab in key["labels"]:
    cfg = lab.split("-")[1]; t = tot.setdefault(cfg, {"automatic": 0, "pre_registered": 0, "correct_oracle": 0, "all_criteria": 0})
    for r in json.load(open(f"{RQ}/runs/{lab}/results.json")):
        sid = r["id"]; exp = gt.get(sid, "PASS"); crit = cat[sid]["acceptance_criteria"]
        t["automatic"] += int(bool(r["done"]))
        asserts = []
        for i, s in enumerate(r["trace"], 1):
            if not s["type"].startswith("expect"): continue
            if not (s.get("accepted") or s.get("executionFailed")): continue
            iid = stepitem.get((lab, sid, i))
            rel = maj([ST[k][iid]["R1_relevance_0_1_2"].strip() for k in ST]) if iid else None
            cor = maj([ST[k][iid]["R2_correct_yes_no_unsure"].strip().lower() for k in ST]) if iid else None
            d = f"{s['type']} {s.get('role','')} \"{s.get('name','')}\"" + (f" {s.get('attribute')}={s.get('value')}" if s["type"] == "expectAttribute" else "")
            asserts.append(dict(item=iid, desc=d, exec="FAIL" if s.get("executionFailed") else "PASS", rel=rel, cor=cor))
        it = [x for x in key["scenarios"] if x["scenarioId"] == sid and any(y["label"] == lab for y in x["runs"])]
        covered = None
        if it:
            sets = [set(int(x) for x in str(SR[k][it[0]["itemId"]]["covered_criteria_numbers"]).replace(",", " ").split() if x.strip().isdigit()) for k in SR]
            covered = [j + 1 for j in range(len(crit)) if sum(j + 1 in z for z in sets) >= 2]
        if exp == "PASS":
            pre = bool(r["done"] and covered); strict = pre
            full = bool(r["done"] and covered is not None and len(covered) == len(crit))
            reason = ("done; majority: script covers criteria " + ",".join(map(str, covered))) if pre else ("not done" if not r["done"] else "done, but no criterion covered")
        else:
            fa = [a for a in asserts if a["exec"] == "FAIL"]
            pre = bool(r["verdict"] == "FAIL" and fa and fa[0]["rel"] == "2"); strict = bool(pre and fa[0]["cor"] == "yes"); full = False
            reason = f"failed on assertion rated relevance {fa[0]['rel']}; expected value judged {fa[0]['cor']}; log: {r.get('error')}" if fa else "no failing assertion (agent stopped)"
        t["pre_registered"] += int(pre); t["correct_oracle"] += int(strict); t["all_criteria"] += int(full)
        if pre or r["done"]:
            rows.append(dict(config=cfg, scenario=sid, expected=exp, agent_verdict=r["verdict"], done=r["done"],
                             criteria=" | ".join(f"{j+1}. {c}" for j, c in enumerate(crit)),
                             assertions=" || ".join(f"[{a['item']}] {a['desc']} -> {a['exec']} (relevance {a['rel']}, correct {a['cor']})" for a in asserts),
                             criteria_covered_by_majority=",".join(map(str, covered or [])),
                             pre_registered=int(pre), correct_oracle=int(strict), all_criteria=int(full), reason=reason))
for c in sorted({o["configId"] for it in key["steps"] for o in it["occurrences"]}):
    occ = [it["itemId"] for it in key["steps"] for o in it["occurrences"] if o["configId"] == c]
    d = {i: maj([ST[k][i]["R3_decision_accept_edit_reject"].strip().lower() for k in ST]) for i in occ}
    judged = [i for i in occ if d[i]]; acc[c] = f"{sum(d[i] == 'accept' for i in judged)}/{len(judged)}"
os.makedirs(f"{ROOT}/appendix", exist_ok=True)
with open(f"{ROOT}/appendix/verified_success_trace.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print("Table III (counts out of 17 scenarios) and accepted steps (n/N, no-majority excluded):")
for c in sorted(tot): print(c, tot[c], "accepted", acc.get(c))

# How each completion arose: the planner's own done flag, or the harness rule in agent.js that treats the same
# accepted step proposed twice in a row as "done" (note 'auto-done: pengulangan step identik').
how = collections.Counter(); planner_done = 0; n_steps = 0
for lab in key["labels"]:
    for r in json.load(open(f"{RQ}/runs/{lab}/results.json")):
        n_steps += len(r["trace"]); planner_done += sum(bool(s.get("done")) for s in r["trace"])
        if r["done"]:
            how["repeated-step rule" if any("auto-done" in (s.get("note") or "") for s in r["trace"]) else "planner done flag"] += 1
print("Completed episodes by source:", dict(how), f"| steps with planner done=true: {planner_done}/{n_steps}")
