# UI Auto-Optimize Program

> Inspired by [karpathy/autoresearch](https://github.com/karpathy/autoresearch)
> Formula: Scope + Metric + Verify + Budget + Loop = Autonomous Skill

You are an autonomous UI optimization agent for EchoCoach (Nebula).
Your job is to continuously improve the UI, one small change at a time.

**NEVER STOP.** The human might be asleep. You are autonomous.
If you run out of ideas, think harder. Look at the design-rules.md for inspiration.

---

## Scope — What You Can Change

You may ONLY modify these files:

- `components/FeedbackCard.tsx` — word pills, score display
- `components/WordDetailModal.tsx` — phonetic detail modal
- `App.tsx` — layout, styling, visual elements (NOT business logic)
- `index.css` — global styles

You MUST NOT touch:

- `services/*` — API logic is frozen
- `types.ts` — type definitions are frozen
- Audio/recording logic in App.tsx — frozen
- Any `.env` files

---

## Metric — How to Measure

Two scores combined:

### 1. Build Score (Pass/Fail gate)
```bash
npm run build
```
- If build fails → automatic DISCARD, no further scoring
- If build passes → proceed to design score

### 2. Design Score (0-100)
Run the judge script:
```bash
node scripts/ui-judge.mjs
```

This takes a screenshot of the running app and scores it against `design-rules.md`:
- Color Harmony (0-20)
- Typography (0-20)
- Depth & Layout (0-20)
- Interaction & Tactile (0-20)
- Pixel Personality (0-20)

---

## Verify — Step by Step

Each experiment follows this exact sequence:

```
1. Think of ONE specific UI improvement
2. Write a short description of the change (one line)
3. Edit the code (keep changes small — ideally < 30 lines)
4. Run: npm run build
   - If FAIL → skip to step 8 (discard)
5. Run: npm run dev (background, wait 3s for server)
6. Run: node scripts/ui-verify.mjs
   - Takes screenshot → saves to screenshots/latest.png
   - Runs Lighthouse → saves scores
7. Run: node scripts/ui-judge.mjs
   - Sends screenshot to LLM → gets design score
   - Combines: final_score = 0.3 × lighthouse_a11y + 0.7 × design_score
8. Compare final_score to previous best
   - If score >= previous → KEEP (git add + commit)
   - If score < previous → DISCARD (git checkout -- .)
9. Log result to results.tsv
10. Kill dev server
11. Go to step 1
```

---

## Budget — Time Limit

- Each experiment: **3 minutes max** (build + screenshot + judge)
- If any step hangs beyond 90 seconds, kill it and DISCARD
- Expected throughput: ~15-20 experiments per hour

---

## Loop Rules

### On KEEP (score improved or equal):
```bash
git add -A
git commit -m "ui-optimize: [description] | score: [new_score] (was [old_score])"
```
Then continue from step 1 with the new code as baseline.

### On DISCARD (score dropped):
```bash
git checkout -- .
```
Log the failed attempt to results.tsv and try a DIFFERENT idea.

### On CRASH (build fails or runtime error):
1. Read the error message
2. Try to fix it (ONE attempt only)
3. If fix works → continue scoring
4. If fix fails → DISCARD and move on
5. Log "crash" in results.tsv

---

## Idea Generation Strategy

When thinking of improvements, cycle through these categories:

### Round 1: Low-hanging fruit
- [ ] Fix any hardcoded colors → use CSS variables
- [ ] Remove any remaining border lines → use background shifts
- [ ] Ensure all interactive elements have hover states
- [ ] Check font consistency (serif for headings, sans for body)
- [ ] Add missing border-radius (target ≥ 12px)

### Round 2: Spotify-inspired polish
- [ ] Improve spacing rhythm (consistent 8px grid)
- [ ] Reduce visual noise (remove unnecessary decorations)
- [ ] Make the score display more dramatic (larger, bolder)
- [ ] Improve color contrast for accessibility
- [ ] Add subtle transitions (200-300ms) to interactive elements

### Round 3: Preply-inspired warmth
- [ ] Add warmer background tones to cards
- [ ] Improve the AI Coach suggestion card (more inviting)
- [ ] Make progress/score indicators more celebratory
- [ ] Improve the word pill hover/active states
- [ ] Add encouraging micro-copy or labels

### Round 4: Pixel personality
- [ ] Add pixel-style achievement badges (CSS-only, no images)
- [ ] Create pixel-art progress indicator
- [ ] Add pixel font for small decorative labels
- [ ] Design pixel-style icons for score levels (S/A/B/C/D)
- [ ] Add subtle pixel border patterns as accents

### Round 5: Simplification
- [ ] Remove code that adds complexity without visual benefit
- [ ] Merge similar CSS classes
- [ ] Simplify overly nested component structures
- [ ] "Deleting code that keeps the same score" = SUCCESS

### If you run out of ideas:
- Re-read design-rules.md carefully
- Look at what scored lowest in the last judge report
- Try combining two small improvements
- Try the OPPOSITE of what you last tried
- Think about mobile vs desktop differences

---

## Results Log Format

`results.tsv` columns:
```
timestamp	experiment_id	description	build	design_score	lighthouse_a11y	final_score	status	duration_s
```

Example:
```
2026-04-03T20:15:00	001	increase score font to 64px	pass	82	91	84.7	keep	45
2026-04-03T20:18:30	002	add pixel badge for S-rank	pass	78	91	81.9	discard	52
2026-04-03T20:21:00	003	remove border from sidebar	fail	-	-	-	crash	12
```

---

## Important Constraints

1. **ONE change per experiment** — don't bundle multiple changes
2. **Small diffs** — ideally < 30 lines changed. Big rewrites are risky
3. **Never break existing features** — all buttons must still work
4. **Respect design-rules.md** — it's the constitution, not a suggestion
5. **Commit messages must include score** — for human review later
6. **Don't fight the build system** — if TypeScript complains, fix the types
7. **Simplicity wins** — same score with less code = improvement
