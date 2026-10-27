# Example traces (configuration A0)

Generated from raqa/runs/abl-A0/results.json and the anonymised ratings. Gate rule: auto-accept if c_t >= 0.8; escalations and audits are answered by the stub (accept if c_t >= 0.6, otherwise reject).

## Trace 1: successful scenario: S-HOME-01

- Goal: The 'Daftar PSB' call-to-action leads to the admission site.
- Acceptance criteria: href is https://psb.pesantrenpersis27.com

### Step 1
- Proposed step: expectAttribute role=link name="Daftar PSB " attribute=href value="https://psb.pesantrenpersis27.com"
- Cited units: catalog:S-HOME-01#0
- Scores: c_act=1, c_loc=1, c_orc=1, c_t=1
- Gate decision: auto
- Accepted into trace: True; execution failed: False
- Rating item L061: decisions by raters R1/R2/R3 = ['accept', 'accept', 'accept']

### Step 2
- Proposed step: expectAttribute role=link name="Daftar PSB " attribute=href value="https://psb.pesantrenpersis27.com"
- Cited units: catalog:S-HOME-01#0, readme:T1#0
- Scores: c_act=1, c_loc=1, c_orc=1, c_t=1
- Gate decision: auto
- Accepted into trace: True; execution failed: False
- Rating item L061: decisions by raters R1/R2/R3 = ['accept', 'accept', 'accept']

- Final: done=True, verdict=PASS, error=None

## Trace 2: failed scenario (self-referential step): S-HOME-06

- Goal: A visitor expands an FAQ question.
- Acceptance criteria: The corresponding answer is visible

### Step 1
- Proposed step: expectAttribute role=button name="Bagaimana syarat masuk PPI 27?" attribute=aria-expanded value="aria-expanded"
- Cited units: catalog:S-HOME-06#0, catalog:S-SMOKE-01#0, baseline-runs:S-PAGE-01#33, catalog:S-AUTH-05#0, catalog:S-LINK-02#0
- Scores: c_act=1, c_loc=1, c_orc=1, c_t=0
- Gate decision: reviewer; stub answer: reject
- Accepted into trace: False; execution failed: False
- Rating item L010: decisions by raters R1/R2/R3 = ['reject', 'reject', 'reject']

- Final: done=False, verdict=INCOMPLETE, error=ditolak reviewer pada langkah 1
