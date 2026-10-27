"""RQ1: paired comparison of flaky tests on staging vs local (exact McNemar). Run from package root."""
import csv
from scipy.stats import binomtest
load = lambda p: {(r["scenario_id"], r["project"], r["title"]): r["verdict"] for r in csv.DictReader(open(p, encoding="utf-8-sig"))}
s = load("results/metrics/baseline/per-test.csv"); l = load("results/metrics/baseline-local/per-test.csv")
k = set(s) & set(l)
b = sum(s[x] == "flaky" and l[x] != "flaky" for x in k); c = sum(s[x] != "flaky" and l[x] == "flaky" for x in k)
print(f"tests={len(k)} staging-only flaky={b} local-only flaky={c} exact McNemar p={binomtest(min(b, c), b + c, 0.5).pvalue:.4f}")
