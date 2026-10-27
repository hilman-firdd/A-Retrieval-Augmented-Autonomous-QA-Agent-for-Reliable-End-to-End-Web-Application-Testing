# Replication package

This package supports the manuscript "Offline Human Review Reveals Overstated Success and Confidence Signals in an
LLM Web Testing Agent". It allows two different things, which should not be confused:

1. **Recomputing every reported number from the released logs and ratings.** This needs only Node.js (no extra
   packages) and Python 3 with numpy, scipy, statsmodels, krippendorff, and matplotlib. No access to the tested
   application is needed.
2. **Re-running the agent or the baseline suite.** This needs the tested application and its database, which are
   not public. The agent code, prompt, configuration, and dependency locks are included so the procedure can be
   inspected and applied to another application, but the original runs cannot be repeated by outside readers.

## Contents

| Path | What it is |
|---|---|
| `raqa/src/` | Agent source. `agent.js` holds the system prompt, the gate (`score()`, `gate()`), and the stopping rules in `runScenario()` (planner done flag, repeated accepted step, step budget); `locatorScore.js`, `oracle.js`, `stubReviewer.js`, `retrieval.js`, `config.js` hold the formulas, stub rule, and parameters (τ = 0.8, audit 5 %, seed 1; RRF κ = 60; top-5). |
| `raqa/scripts/ablation-configs.js` | The six configurations (A0, A1, A2, A3, A6, A7). |
| `package-lock.json`, `raqa/package-lock.json` | Dependency locks. Models: Qwen3 4B (`qwen3:4b`, Ollama ID 359d7dd4bcda, Q4_K_M) and nomic-embed-text (ID 0a109f422b47) via Ollama 0.33.3. |
| `scenarios/catalog.json`, `scenarios/prereg-ablation.json`, `scenarios/ground-truth.json` | Scenario catalogue (a retrieval source), pre-registered scenario set, and correct verdicts. |
| `results/runs/baseline/`, `README.md` (section "Temuan awal") | The other two retrieval sources: baseline execution traces and defect notes. |
| `raqa/runs/abl-*/results.json` | Per-step logs: proposed step, cited units, c_act, c_loc, c_orc, c_t, gate decision, stub answer, execution result. |
| `raqa/review/` | Anonymised ratings (R1–R3), rating sheets, hidden key that maps items to configurations, rater guide. |
| `results/metrics/` | Baseline flakiness and fault-detection summaries. `faults/faults.csv` lists the seeded faults. The patches in `faults/patches/` contain excerpts of the closed application's source code (see the note at the end). |
| `raqa/scripts/compare_runs.py` | Compares later runs (larger model, repeated runs) with the original ablation; needs no human labels. Not used for any number in the manuscript. |
| `reanalysis/` | Scripts added for the revised manuscript (gate signals, agreement, endpoints, figures, traces). |
| `appendix/` | `verified_success_trace.csv` (success-tracing table) and `example_traces.md` (one successful and one failed trace). |

## From scripts to tables and figures

Run all commands from the package root unless stated otherwise.

| Manuscript item | Command | Output to compare |
|---|---|---|
| Table I | `results/metrics/baseline/summary.json`, `results/metrics/baseline-local/summary.json` (produced by `scripts/compute-metrics.js` from the run reports) | 12 and 1 flaky tests |
| RQ1 McNemar test | `python3 -I reanalysis/baseline_mcnemar.py` | 12 vs 1 discordant tests, p = 0.0034 |
| Table II, κ = 0.648 | `node raqa/scripts/h0-failure-classification.js analyze raqa/review/h0-sheet-R2.csv` | κ = 0.648, 16/19 |
| Fault detection (8/25) | `results/metrics/fault-detection/summary.json` | 8 of 25 |
| Table III (pre-registered endpoint, Δ, Holm p, steps accepted) | `node raqa/scripts/analyze-hitl.js --baseline A0` | `raqa/review/analysis.md`, tables H2 and A1 |
| Table III (correct-oracle and all-criteria columns, n/N); source of every completion (RQ2) | `python3 -I reanalysis/endpoints_and_trace.py .` | printed counts (26 completions, all from the repeated-step rule; planner done flag on 0 of 133 steps); `appendix/verified_success_trace.csv` |
| Tables IV and V, Fig. 2, κ values in RQ3 | `cd reanalysis && python3 -I gate_irr_reanalysis.py .. reanalysis.json && python3 -I make_fig2.py` | `reanalysis.json` (A0, Table V, τ sweep, random baseline for A0), `table_iv_unique.json` (every Table IV row and the random baseline for the 57 unique steps), `fig2_gate.png` |
| Robustness runs (three 4B repetitions, three 8B repetitions; not pre-registered) | `cd raqa && node scripts/analyze-repeats.js --group 4b=abl,abl4b-r2,abl4b-r3 --group 8b=abl8b-r1,abl8b-r2,abl8b-r3 && cd ..` and `python3 -I reanalysis/repeats_unique.py . reanalysis/repeats_unique.json` | `raqa/review/analysis-repeats.md` (occurrence-based); `reanalysis/repeats_unique.json` (unique labelled steps for 4B, objective measures for both models) |
| Example traces | `cd reanalysis && python3 -I example_traces.py` | `appendix/example_traces.md` |

The original analysis script (`raqa/scripts/analyze-hitl.js`) was re-run on 26 October 2026. All numbers in
`raqa/review/analysis.md` were unchanged; only table labels were updated to the manuscript's terms (pre-registered and
correct-oracle endpoints) and the ground-truth path is now stored relative to the repository root.

`raqa/review/analysis.md` also has Table H3-K, which pools step **occurrences** over the five retrieval
configurations (n = 112; κ = 0.785; 6 of 59 auto-accepted not accepted). The manuscript reports the same analysis on
**unique steps** (Table IV; n = 57; κ = 0.747; 4 of 24), because one step can occur in several configurations and
occurrences are not independent observations. Both come from the same logs and ratings.

## Pre-registration and deviations

- Application version frozen at commit 91db4a96; scenario set and ground truth pre-registered in commit 7b08f79
  (23 September 2026, 21:45 WIB), before the first agent run.
- Post hoc additions, all labelled as such in the manuscript: the correct-oracle rule; the signal-level gate
  analysis; the all-criteria column; the unique-step analysis.
- The self-referential rule in the gate (`raqa/src/agent.js`, `score()`) is present from the first commit of this
  repository (0eda785, 22 September 2026) and was active in the pilot run `raqa/runs/raqa-v3`, so it was in place
  before the pre-registration and before every ablation run. It was not described in the earlier manuscript version
  and is now Eq. (5).
- Not run although planned: configuration A4 (no defect notes) and the interactive review sessions (H2).
- The robustness runs (`abl4b-r2/r3-*`, `abl8b-r1/r2/r3-*`, 26–27 October 2026) were not pre-registered. They used
  the agent code of commit 92ede45, which adds a 5-minute limit per model call and marks scenarios whose start page
  did not load as infrastructure errors; see `raqa/runs/repeats-manifest.json`.
- Rating files set aside before analysis: see the manuscript (Method, Ablation and Human Verification). These
  decisions were made when the files arrived and were not pre-registered.
- The manual timing pilot in `raqa/review/manual-timing.csv` is not reported in the manuscript (one tester, different
  device and deployment, tester had seen the agent's output).

## Note on the seeded-fault patches

The manuscript states that the SIMASIS code and database are not public. The files `faults/patches/F01–F25.patch`
contain diff excerpts of SIMASIS source code. If the application owner does not agree to publish these excerpts, the
patches should be removed from the public repository (including its history) and `faults/faults.csv` kept as the
public description.
