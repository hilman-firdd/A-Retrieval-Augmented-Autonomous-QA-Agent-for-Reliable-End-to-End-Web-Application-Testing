"""Fig. 2. Needs fig_data.json written by gate_irr_reanalysis.py (run that first, from this folder)."""
import json, matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, numpy as np
plt.rcParams.update({"font.family": "serif", "font.size": 10, "mathtext.fontset": "stix"})
d = json.load(open("fig_data.json"))
order = [("full (as implemented)", "Full gate"), ("self-ref rule only", "Self-referential rule only"),
         ("min(c_act,c_loc,c_orc), no self-ref rule", "Three signals, no rule"), ("c_loc only", r"$c^{\mathrm{loc}}$ only"),
         ("c_act only", r"$c^{\mathrm{act}}$ only"), ("c_orc only", r"$c^{\mathrm{orc}}$ only"), ("accept all", "Accept all")]
keys = [a for a, b in order][::-1]; labels = [b for a, b in order][::-1]
a0 = [d["A0"][k]["kappa"] for k in keys]; un = [d["unique"][k]["kappa"] for k in keys]
fig, ax = plt.subplots(figsize=(4.6, 3.0), dpi=300); y = np.arange(len(keys)); h = 0.38
b1 = ax.barh(y + h / 2, a0, h, color="#2a78d6", label="A0 (n = 21)", edgecolor="white")
b2 = ax.barh(y - h / 2, un, h, color="#eb6834", label="57 unique steps", edgecolor="white", hatch="///")
for bars, vals in ((b1, a0), (b2, un)):
    for r, v in zip(bars, vals): ax.text(max(v, 0) + 0.02, r.get_y() + r.get_height() / 2, f"{v:.2f}", va="center", fontsize=7.5)
ax.axvline(0, color="#555", linewidth=0.8); ax.set_yticks(y); ax.set_yticklabels(labels); ax.set_xlim(-0.15, 1.15)
ax.set_xlabel("Cohen's κ with the raters' majority decision"); ax.legend(loc="lower right", fontsize=8, frameon=False)
plt.tight_layout(); plt.savefig("fig2_gate.png", dpi=300); print("fig2_gate.png written")
