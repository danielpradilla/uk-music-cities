# Research TODO

This is the central backlog for future investigations and project evolutions.
The study reviews, analysis notebooks and suggestions made during the project
feed into this file; they are not separate task lists.

When a new idea appears, write down the question, why it matters, its source or
date, and the first concrete output. Merge duplicates rather than scattering
reminders across the repository. When work is completed, record the result in
[`ANALYSIS_HISTORY.md`](ANALYSIS_HISTORY.md) and remove it from this backlog or
replace it with the next unresolved question.

The publication sequence and boundaries are defined in
[`STUDY_PROGRAMME.md`](STUDY_PROGRAMME.md).

## Source reviews

This backlog consolidates all four study reviews:

- [`STUDY_REVIEW_1.md`](STUDY_REVIEW_1.md) — initial methodological critique
  and proposed research branches.
- [`STUDY_REVIEW_2.md`](STUDY_REVIEW_2.md) — evaluation after Experiments
  16–23 and definition of the three-study programme.
- [`STUDY_REVIEW_3.md`](STUDY_REVIEW_3.md) — evaluation after the origin audit,
  article rewrite and Experiment 24.
- [`STUDY_REVIEW_4.md`](STUDY_REVIEW_4.md) — 5 September 2026 review of the
  revised catalogue, release consistency, historical designs and panel protocol.

Where their recommendations differ, Review 4 is the current position. Earlier
reviews remain historical evidence, including their then-current numbers.
Unless a different source/date is stated, the new acceptance criteria below
come from Review 4; they extend or merge the earlier recommendations.

## Do now

- [ ] **Start the longitudinal Spotify panel.** Freeze the artist panel and one
  extraction schema before a feasibility capture, then collect followers and
  monthly listeners on the same calendar day each month. Store exact UTC times,
  raw responses, validation results and the extraction-method version. Maintain
  an event table for releases, tours, reissues, festival appearances, viral
  events, deaths and membership changes. First output: a dated protocol and
  validated capture with failed rows retained. Review feasibility at 12
  observations; aim for 18–24 months, with modelling conditional on coverage,
  method continuity and enough comparable observations or events.

- [ ] **Reconcile the current release before citing its experiments.** Review 4
  found 95 changed score/rank rows, including 25 changed ranks, when rebuilding
  Experiment 16 from current inputs. Rebuild affected upstream outputs before
  downstream notebooks and check their joins and numbers against the saved
  tables. First output: a discrepancy ledger closed by a reproducible build,
  with observation, catalogue, mapping, population and build revisions recorded.

- [ ] **Run Experiment 25: candidate-frame coverage and score stability.** For
  every FUA, show the funnel from discovered acts through group eligibility,
  Spotify matching, evidenced formation place, FUA mapping and final selection.
  Produce a machine-readable inclusion/exclusion ledger; compare common-`k`,
  fixed-threshold and all-reviewed-candidate rules; report score changes,
  dominant-band share and effective-band count as well as ranks. This should
  explain whether Bristol and Leicester are limited by true catalogue size,
  source coverage, identity resolution or mapping. Separate unknown origin,
  evidenced outside-FUA origin, excluded non-UK identity, mapping tier and
  missing population; do not turn missing evidence into observed absence.
  Report coverage by both band count and audience weight, with cohort, genre
  and popularity strata plus explicit unknown groups. First output: the
  funnel, ledger and score-change tables in the Experiment 25 notebook.

## Current publication

- [ ] Make the ten-largest-FUA scope visible in every headline and summary that
  could otherwise imply a UK-wide ranking.
- [ ] Retain the article's Oxford/top-20 disclosure and make the absence of a
  universal multiverse winner explicit in every publication summary that needs
  the qualification. Verify claims against the reconciled release.
- [ ] Use one reader-facing metric name throughout: **selected-band Spotify
  footprint index**. Use **dominant-band sensitivity** for the one-band-removal
  check rather than calling it scene depth.
- [ ] Reconcile README, article, methodology and chart claims with the current
  tables: the final excluded order begins Sheffield, Manchester, London,
  Liverpool; both Experiment 24 rank correlations are 1.000; and the final
  observations span two capture batches, 5 minutes 22 seconds apart. First
  output: a claim-to-table check, including removal of stale numeric examples.
- [ ] Add percentage changes in score levels to Experiment 24 alongside rank
  changes, and show overlap and changed audience weight by city. Disclose that
  Sheffield, Liverpool and Glasgow now have identical selections in both arms.
  Preserve the pre-comparison baseline and distinguish retrospective catalogue
  revision from independent validation. First output: a dated selection-change
  table and revised interpretation beside the comparison chart.
- [ ] Freeze a labelled publication release, rerun the final notebook and
  every experiment cited by the article from it, and record the commands and
  environment. Include input hashes and separate source observation dates from
  catalogue/mapping revisions and the analysis build date.
- [ ] Define the invariants protected by the reduced test suite, add a
  clean-install smoke test and run the release checks automatically. The current
  16 tests pass, but do not catch stale multiverse outputs, partial Wikipedia
  windows or discarded date precision. Add a small regression check for each
  when fixing the relevant path, rather than asserting a preferred winner.
- [ ] Decide whether the repository is an archival release or remains
  refreshable. If refreshable, retain or replace the upstream collection and
  identity-resolution entry points.

## Study 1 — measurement and rankings

- [ ] Assemble Experiments 16, 17, 23, 24 and 25 into the separate measurement
  article promised by the current essay.
- [ ] Create one result ledger listing the universe, catalogue rule, metric,
  score, eligible-city count, winner and concentration diagnostic for each
  headline specification. Include mapping tier and input revision so the
  663 strict mappings and 666 extended mappings are not confused.
- [ ] Separate candidate eligibility from selection with one canonical candidate
  table and an explicit inclusion or exclusion reason for every act.
- [ ] Audit every systematic-catalogue act responsible for at least 10% of an
  FUA's score and every mapping capable of changing a rank.
- [ ] Pre-register the candidate universe, selection rule, origin alternatives,
  primary metric, population denominator, exclusions and tie rules before the
  next Spotify capture is inspected.
- [ ] **Audit candidate recall independently.** Build a bounded reference list
  from independent local archives or catalogues for the pilot cities, then
  report discovery, eligibility and identity-resolution rates against that list.
  First output: a source-overlap/missed-act table. Do not describe reference-list
  recall as completeness for all bands or invent inclusion probabilities.
- [ ] **Isolate rule effects within common populations.** Add matched pairs to
  Experiment 16 holding the candidate release and FUA set fixed while changing
  one rule. Separate absolute scale, adjusted audience and breadth; show
  family-specific rank and score changes, eligibility, and any family-weight
  sensitivity. First output: a controlled comparison table. Top-five frequencies
  across universes of 10–83 FUAs are not probabilities of being best.
- [ ] **Audit the `1×` benchmark and model sensitivity.** Compare the existing
  all-selected output denominator with a labelled mapped-only denominator,
  preserving excluded mass. Explain why the population-weighted mean is 0.926
  for the current follower quotient. For count/follower models, report mapping,
  zero-row, threshold and regional-exclusion sensitivity before interpreting
  residuals. First output: benchmark reconciliation and model-sensitivity tables.
- [ ] **Test an independent selection prospectively.** After Experiment 25,
  freeze a second selection without access to audience values or city ranks,
  or evaluate pre-frozen catalogues on the next capture. First output: a dated
  selection protocol and later score comparison, with editorial revisions
  recorded separately from validation.

## Study 2 — scenes and mechanisms

- [ ] **Band births, local clusters and historical city trajectories — suggested
  4 September 2026.** Ask whether bands form randomly across places and years or
  emerge in local bursts that can be related to cultural movements in a city's
  history. Build a formation-year-by-FUA panel and compare observed bursts with
  a population- and coverage-aware baseline. Treat the presence of a cluster as
  evidence for further historical investigation, not proof that the city caused
  it. Separate a selected-survivor cohort analysis from a historical births
  study, which needs a bounded archival frame including acts without Spotify
  pages. First output: a pilot frame and formation-period-by-FUA table, with
  unknown years and incomplete recent cohorts explicit.
- [ ] **Build a formation-year cutoff slider — clarified 4 September 2026.** For
  a selected year `Y`, include only bands formed on or before `Y`, keep their
  frozen 2026 Spotify metric fixed, aggregate them by place and recalculate the
  city ranking. Label the result **2026 Spotify footprint of bands formed by
  Y**. The map and ranked chart should update together, disclose bands with a
  missing or uncertain formation year, and work with both raw totals and the
  population-normalized view. A city's cumulative score cannot fall as the
  cutoff advances, but its rank can fall when bands from other cities enter.
  This is a retrospective cohort view, not popularity as it stood in year `Y`;
  a true historical-impact view would require contemporaneous evidence. Freeze
  population, catalogue and geographic attribution while moving the slider.
  For year ranges, show definitely-included and possibly-included score bounds,
  with unknown-year acts visible. First output: an audited date table followed
  by the linked map/chart; verify cumulative score monotonicity and tie handling.
- [ ] Select three or four contrasting FUAs for a historical pilot: recurring
  high output, broad catalogue depth, superstar concentration and weak measured
  output. Use common periods and search effort; include a counterexample to the
  proposed institution/scene relationship. First output: a case-selection and
  source-coverage matrix written before testing explanations.
- [ ] Define a sustained scene before selecting explanatory variables.
- [ ] Build a reviewed canonical formation-period field from multiple sources,
  preserving conflicts and year ranges. Retain Wikidata precision and statement
  evidence; stop treating Cassia's and The Irish Brigade's decade-level dates
  as exact years. Replace filename-order conflict resolution with an explicit
  review state, and distinguish formation from renaming, reunion and first
  release. First output: a precision/conflict audit with count- and
  audience-weighted coverage, before any annual-history output.
- [ ] Review broad genre families while retaining secondary genres through
  fractional credit.
- [ ] Reconstruct period-appropriate venues, rehearsal spaces, studios, labels,
  music education, promoters and local media for the pilot cities. Record
  opening/closure dates, capacities, archival gaps and search effort. First
  output: comparable city-period timelines, including counterexamples.
- [ ] Add historical population, rents, transport access, cultural funding and
  relevant economic context.
- [ ] Keep member, producer, label, venue and education networks as separate
  layers, and test only relationships that predate the acts they might explain.
  Preserve dated band-to-person/institution affiliations; compare local ties
  with an era- and affiliation-size-aware baseline and repeat without major
  national labels. Treat undocumented edges as unknown. First output: a dated
  affiliation pilot and projection-sensitivity table.
- [ ] **Define and validate the burst test before scanning cities.** Separate
  a conditional timing null (preserve city totals and national year counts,
  with defensible source/era strata) from a population-exposure births model.
  Predefine window widths, uncertain-year handling and a multiplicity rule.
  First output: one runnable no-burst/injected-burst simulation check plus a
  preregistered pilot protocol; report effect sizes and coverage beside flags.

## Study 3 — cultural footprint and momentum

- [ ] Define each candidate measure as stock, flow, attention, commercial
  success or critical footprint before combining or modelling signals. Record
  rolling-window definitions and actual capture intervals; keep follower levels,
  net changes, monthly listeners and monthly active listeners distinct. First
  output: the panel data dictionary and aligned-window comparison rules.
- [ ] Add stable non-Spotify measures where access permits, including Wikipedia,
  YouTube, Last.fm, charts, radio play and set-list activity. Stabilize the
  Spotify/Wikipedia comparison first, then justify each extra signal with a
  specific question and an exposure/identity audit.
- [ ] Define missing-data and endpoint-change rules before the longitudinal panel
  encounters them. Keep a fixed core plus a separately labelled expansion
  cohort, retain failed observations without zero-filling or silent carry-forward,
  and record artist-page merges/splits. Bridge method changes with overlapping
  captures where feasible. First output: missingness and identity/method ledgers.
- [ ] Once the panel is long enough, model trajectories and event windows while
  retaining the existing two-date comparison as a baseline diagnostic. Assess
  continuity and pre/post support rather than using 12 observations as automatic
  permission to fit trends. Decompose city changes by contributing act and
  protect percentage changes against tiny baselines. For event claims, define
  comparison acts, concurrent events, pre-event checks and placebo dates; pilot
  a small higher-frequency panel only if the question requires it.
- [ ] **Repair Wikipedia exposure checks.** Death Of Guitar Pop and Black Tongue
  have only 10 and seven returned months in the annual comparison. Validate exact
  month keys, duplicates, titles, article history and capture status; distinguish
  missing exposure from true zero. First output: a 922-complete-row baseline and
  separate partial-window audit, followed by updated residual interpretation.
  Do not annualize incomplete totals by simple multiplication.
- [ ] **Test cross-platform agreement within comparable groups.** Report
  completeness and agreement by reviewed formation era, genre and popularity
  stratum; inspect influential discordant acts before assigning cultural meaning
  to residuals. First output: a stratified comparison and sourced case notes,
  retaining language, access and agent filters and small-cell caveats.

## Later investigations and suggestions

- [ ] **Bands versus solo artists:** repeat the comparison with solo acts in a
  separate catalogue and identify which cities and genres gain.
- [ ] **Alternative origin rules:** compare formation place, members' home towns,
  first rehearsal, first public performance, early-career scene and later base.
  Test multiple or weighted place attribution rather than forcing every band
  into one FUA.
- [ ] **Map-place granularity:** audit bands displayed at county level when a
  defensible town is known, and define when the interface should show a town,
  county or unresolved location.
- [ ] **Influence-threshold audit:** repeat the origin review at a 5% contribution
  threshold and check whether any additional assignment changes a rank.
- [ ] **Genre and generations:** compare reviewed genre-period cohorts using
  population estimates close to the period in which the bands formed.
- [ ] **International replication:** apply the stabilized design to comparable
  countries only after the UK candidate frame is defensible.
