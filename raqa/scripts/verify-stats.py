#!/usr/bin/env python3
"""Verifikasi silang scripts/lib-stats.js terhadap pustaka rujukan.
Jalankan dari folder raqa:  python3 scripts/verify-stats.py
Butuh: pip install krippendorff statsmodels scipy scikit-learn"""
import json, subprocess, sys
import numpy as np
import krippendorff
from scipy.stats import wilcoxon, binomtest
from statsmodels.stats.inter_rater import fleiss_kappa
from statsmodels.stats.multitest import multipletests
from statsmodels.stats.proportion import proportion_confint
from sklearn.metrics import cohen_kappa_score

rng = np.random.default_rng(20260922)
cases = {"cohen": [], "fleiss": [], "kripp": [], "mcnemar": [], "wilcoxon": [], "wilcoxon_normal": [], "holm": [], "wilson": []}

for _ in range(40):
    n = int(rng.integers(8, 60)); k = int(rng.integers(2, 4))
    a = rng.integers(0, k, n).tolist(); b = [x if rng.random() < 0.6 else int(rng.integers(0, k)) for x in a]
    cases["cohen"].append({"a": a, "b": b, "ref": float(cohen_kappa_score(a, b))})
for _ in range(40):
    N = int(rng.integers(5, 40)); raters = int(rng.integers(2, 6)); k = int(rng.integers(2, 4))
    counts = np.array([np.bincount(rng.integers(0, k, raters), minlength=k) for _ in range(N)])
    cases["fleiss"].append({"counts": counts.tolist(), "ref": float(fleiss_kappa(counts))})
for _ in range(40):
    R = int(rng.integers(2, 5)); U = int(rng.integers(6, 40)); V = int(rng.integers(2, 5))
    base = rng.integers(0, V, U)
    data = [[(int(base[u]) if rng.random() < 0.7 else int(rng.integers(0, V))) if rng.random() > 0.1 else None for u in range(U)] for _ in range(R)]
    arr = np.array([[np.nan if v is None else v for v in row] for row in data], dtype=float)
    # lewati bila hanya satu nilai unik (alpha tak terdefinisi di paket rujukan)
    if len(set(v for row in data for v in row if v is not None)) < 2: continue
    for lvl in ["nominal", "ordinal", "interval"]:
        cases["kripp"].append({"data": data, "level": lvl, "ref": float(krippendorff.alpha(reliability_data=arr, level_of_measurement=lvl))})
for _ in range(40):
    b = int(rng.integers(0, 15)); c = int(rng.integers(0, 15))
    ref = 1.0 if b + c == 0 else float(binomtest(min(b, c), b + c, 0.5).pvalue)
    cases["mcnemar"].append({"b": b, "c": c, "ref": ref})
for _ in range(40):
    n = int(rng.integers(3, 16))
    d = (rng.integers(-4, 5, n)).tolist()  # banyak ties dan nol, sengaja
    nz = [x for x in d if x != 0]
    if len(nz) == 0: continue
    # Rujukan 1: enumerasi tanda eksak (scipy tidak menyediakan p eksak bila ada ties).
    from itertools import product
    from scipy.stats import rankdata
    r = rankdata(np.abs(nz)); tot = r.sum(); Wp = r[np.array(nz) > 0].sum(); obs = min(Wp, tot - Wp)
    cnt = 0
    for signs in product([0, 1], repeat=len(nz)):
        w = sum(ri for ri, s in zip(r, signs) if s); cnt += (min(w, tot - w) <= obs + 1e-9)
    cases["wilcoxon"].append({"d": d, "ref": cnt / 2 ** len(nz)})
    if len(set(abs(x) for x in nz)) == len(nz):  # tanpa ties: juga cocokkan dengan scipy eksak
        cases["wilcoxon"].append({"d": d, "ref": float(wilcoxon(nz, method="exact").pvalue)})
for _ in range(40):
    n = int(rng.integers(21, 60))
    d = (rng.integers(-3, 4, n)).tolist()
    if sum(1 for x in d if x != 0) < 2: continue
    cases["wilcoxon_normal"].append({"d": d, "ref": float(wilcoxon(d, zero_method="wilcox", method="approx", correction=False).pvalue)})
for _ in range(30):
    m = int(rng.integers(2, 9)); p = rng.random(m).round(4).tolist()
    cases["holm"].append({"p": p, "ref": multipletests(p, method="holm")[1].tolist()})
for _ in range(30):
    n = int(rng.integers(1, 120)); x = int(rng.integers(0, n + 1))
    lo, hi = proportion_confint(x, n, method="wilson")
    cases["wilson"].append({"x": x, "n": n, "ref": [float(lo), float(hi)]})

js = r"""
const S = require('./scripts/lib-stats.js');
const c = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const out = {
  cohen: c.cohen.map(t => S.cohenKappa(t.a, t.b)),
  fleiss: c.fleiss.map(t => S.fleissKappa(t.counts)),
  kripp: c.kripp.map(t => S.krippendorffAlpha(t.data, t.level)),
  mcnemar: c.mcnemar.map(t => S.mcnemarExact(t.b, t.c)),
  wilcoxon: c.wilcoxon.map(t => S.wilcoxonExact(t.d).p),
  wilcoxon_normal: c.wilcoxon_normal.map(t => S.wilcoxonNormal(t.d).p),
  holm: c.holm.map(t => S.holm(t.p)),
  wilson: c.wilson.map(t => S.wilson(t.x, t.n)),
};
process.stdout.write(JSON.stringify(out));
"""
res = json.loads(subprocess.run(["node", "-e", js], input=json.dumps(cases), capture_output=True, text=True, check=True).stdout)

fails = 0
for key, lst in cases.items():
    worst = 0.0
    for t, got in zip(lst, res[key]):
        ref = np.array(t["ref"], dtype=float); g = np.array(got, dtype=float)
        err = float(np.max(np.abs(ref - g)))
        worst = max(worst, err)
        if err > 1e-6:
            fails += 1
            print(f"  GAGAL {key}: ref={t['ref']} js={got} input={ {k: v for k, v in t.items() if k != 'ref'} }")
    print(f"{key:9s} {len(lst):3d} kasus, selisih maksimum = {worst:.2e}")
print("SEMUA COCOK" if fails == 0 else f"{fails} KASUS TIDAK COCOK")
sys.exit(1 if fails else 0)
