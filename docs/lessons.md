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
