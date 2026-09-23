# Lessons

## Never regenerate a file the user may have hand-edited
- 2026-09-21: re-ran `tools/segment_zones.py`, which overwrote `data/garden.json` and wiped the
  user's editor changes to G1–G3 (they were only safe because they had been committed).
- Rule: before regenerating any data file that has an editor, diff it against the last generated
  version (`git diff`, or `git show HEAD:<file>` vs working copy) and ask/merge if it changed.
- Generators of hand-editable files must refuse to overwrite edits (fingerprint + `--force`).

## A validation check passing is not proof: look at the output the way the user will
- The "no holes" check passed while the map had visible gaps, because they were open to the
  outside rather than enclosed. Only zooming into the rendered app revealed them.
- Rule: after a geometry pipeline, render and zoom in on the result; add a check for each defect found
  (here: "garden must be one piece").

## Measure before claiming a gain
- 2026-09-21: claimed a quarter-turn would make the portrait map "~40% bigger" by eyeballing empty
  screen space; after implementing it, measuring showed it was 16% *smaller* (the garden is taller
  than wide). Reverted.
- Rule: any "X% better" claim in a proposal must come from a quick computation, not a visual guess.

## Look at each hand edit before "repairing" it
- 2026-09-23: after the user's A-block edits, I "filled back" every area that had left the garden outline,
  assuming deleted corners were accidents. Rendering each spot showed most were deliberate: the user had
  straightened jagged tracing artefacts around printed text ("4.00", "ht"). My fill put the artefacts back.
- Rule: a diff against an older version says what changed, not whether it's wrong. Before reverting any
  part of a hand edit, render that spot and ask whether it's a cleanup; fix only what is objectively broken
  (invalid shapes, holes, T-junctions) and ask about the rest.

## Don't turn my own design assumptions into rules the user must follow
- 2026-09-23: I treated "zones tile the garden with no gaps" (my phase-1 design choice) as a hard rule: the
  validator failed on gaps, the chemin tool filled whole gaps, and I proposed filling the user's gaps. The user:
  "there is no constraint that all surfaces should be covered. Allow gaps."
- Rule: when a check or tool enforces something, know whether the user asked for it or I assumed it. Only
  enforce what's objectively broken (invalid shapes, overlaps, IDs the backend refuses); ask before
  "fixing" anything else.
