# UK music-cities study programme

This programme separates the current personal essay from three later studies.
Each publication asks a different question and needs different evidence; the
later studies are not expanded versions of the first article.

The actionable work is maintained in [`TODO.md`](TODO.md). Study reviews should
update this programme when they change the research direction and add any new
work to the central backlog.

This version synthesizes [`STUDY_REVIEW_1.md`](STUDY_REVIEW_1.md),
[`STUDY_REVIEW_2.md`](STUDY_REVIEW_2.md) and
[`STUDY_REVIEW_3.md`](STUDY_REVIEW_3.md), with the evidence and design refinements
in [`STUDY_REVIEW_4.md`](STUDY_REVIEW_4.md), reviewed 5 September 2026. Review 4
is authoritative where recommendations differ. Earlier result numbers describe
their historical review states.

## Current publication — the selected-catalogue essay

**Working question:** Among the ten largest UK Functional Urban Areas, which
places have the largest selected-band Spotify footprint relative to population?

**Purpose:** Publish the existing 100-band analysis as a transparent personal
data essay. It is a worked example using one frozen catalogue, not a definitive
ranking of British music cities.

**Evidence available:** The final study notebook, audited origins, documented
inclusion rules, the top-20 extension, the catalogue-selection sensitivity test
and the specification multiverse.

**Remaining work:** Reconcile current inputs, saved experiment outputs and
narrative claims, then complete the release and reproducibility tasks in
[`TODO.md`](TODO.md#current-publication).

## Study 1 — how measurement choices construct rankings

**Working title:** *When the Winner Depends on the Rules: Measuring Britain's
Music Cities*

**Central question:** How do defensible definitions of band, city, popularity
and scene depth change which places appear to punch above their population
weight?

**Evidence available:** Experiments 16, 17, 23 and 24 cover specification
sensitivity, catalogue depth, an independent attention measure and alternative
band selection.

**Required next work:** Explain uneven candidate coverage, compare common-size
and threshold-based catalogues, and assemble the results as a separate
measurement article. The study should report output and breadth together and
should not nominate a universal winner. Audit recall against an independently
assembled reference list, compare rule changes within common FUA populations,
and distinguish retrospective catalogue revision from prospective validation.

**Publication shape:** A visual methods-and-measurement article showing that a
music-city ranking is produced by its definitions.

## Study 2 — how music scenes persist

**Working title:** *Scenes, Not Superstars: Institutions, Genre Lineages and
Networks*

**Central question:** Which urban institutions and musical networks are
associated with sustained, multi-act production across genres and generations?

**Historical clustering question:** Do bands emerge randomly across places and
years, or in local bursts associated with identifiable cultural movements in a
city's history? The current popularity-selected catalogue can test clustering
among surviving selected acts. Historical band-birth rates require a bounded
archival frame that also includes acts without current Spotify visibility.

**Evidence available:** Experiments 18–21 provide feasibility checks for
formation years, genre histories, infrastructure and band networks. They
generate hypotheses but do not support causal explanations.

**Required next work:** Begin with a small historical pilot across contrasting
cities. Build a reviewed formation-year-by-FUA panel, test whether local bursts
exceed a population- and coverage-aware baseline, and reconstruct
period-appropriate venues, studios, labels, education, local media, transport,
rents, funding and population. Keep member, producer, label, venue and education
networks separate, and require proposed causes to predate the bands they are
meant to explain. Preserve date precision and conflicts, define the clustering
null and scanning correction before testing, and include historical
counterexamples and comparable search effort across pilot cities.

**Interactive output:** A cutoff-year slider should update the map and ranking.
For year `Y`, include only bands formed on or before `Y` and rank cities using
those bands' frozen 2026 Spotify values. Label the measure **2026 Spotify
footprint of bands formed by Y**. This is a retrospective cohort view, not a
claim about popularity in year `Y`: a 1970 selection can exclude Sheffield bands
that had not formed yet without pretending that today's Beatles audience is a
measurement taken in 1970. Absolute cumulative city scores cannot decline as
the cutoff advances, although ranks can change when later bands enter. Hold
population and geographic attribution fixed while moving the cutoff. Use
definite/possible inclusion bounds for uncertain dates and keep unknown-year
acts visible; historical population is a separate comparison.

**Publication shape:** A cultural-analytics or urban-cultural-policy study after
substantial historical data collection.

## Study 3 — cultural footprint and platform momentum

**Working title:** *Cultural Footprint and Platform Momentum*

**Central question:** Which signals capture durable cultural footprint, and
which capture current listening, public attention or event-driven momentum?

**Evidence available:** Experiments 22 and 23 show that followers, monthly
listeners and Wikipedia attention overlap without measuring the same thing.
Two Spotify observations are a comparison, not a trend.

**Required next work:** Collect followers and monthly listeners for a fixed
artist panel on the same day each month for 18–24 months. Preserve the raw
responses and extraction method, and annotate releases, tours, reissues, viral
events, deaths and membership changes. Add stable non-Spotify signals where
access permits, starting by validating complete Wikipedia observation windows.
Keep capture failures and identity/method changes explicit, distinguish rolling
listener windows from follower changes, and separate any expansion cohort from
the fixed panel. Twelve observations is a feasibility checkpoint; event and
trend claims require adequate temporal support, comparison cases and checks
for competing explanations, not merely a minimum number of months.

**Publication shape:** A longitudinal study of platform indicators once the
panel is long enough to analyse trajectories and events.

## Later comparative extensions

These are distinct investigations rather than extra controls to add to the
current essay:

- Repeat the study with solo artists and compare which cities and genres gain.
- Compare formation place with members' origins, first rehearsal, first public
  performance, early-career scene and later base; allow multiple places where
  the evidence warrants it.
- Compare genre and formation-period cohorts using reviewed historical data and
  period-appropriate populations.
- Replicate the design in comparable countries only after the UK candidate
  frame and rules are stable.
