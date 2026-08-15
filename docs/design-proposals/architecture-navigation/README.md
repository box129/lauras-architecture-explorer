# Architecture Navigation UX Concepts

These images are non-authoritative UX concept references created after
Participant #1's formative usability dry run.

They illustrate desired:

- architecture hierarchy;
- categorization;
- progressive disclosure;
- navigation;
- drill-down;
- graph focus;
- contextual explanations;
- architectural-statement/evidence/source continuity.

They DO NOT define architectural ground truth.

Names, categories, descriptions, counts, relationships and confidence
values shown in the mockups are illustrative.

Before implementing any concept, every visual/semantic element must be
mapped to data that Laura's already produces or can derive
deterministically without changing research semantics.

## Concept files

### concept-01a-overview-clustered-map.png

State 1, Option A.

Shows the repository overview as visibly grouped clusters containing
representative modules.

This explores whether Laura's existing areas/modules can be progressively
grouped without introducing new architectural inference.

### concept-01b-overview-domain-cards.png

State 1, Option B.

Shows a more strongly abstracted architecture overview using larger
functional/domain cards.

This is intentionally more ambitious.

Names such as "Request Lifecycle" or "Core Flask Framework" must NOT be
treated as ground truth unless current Laura's data actually supports those
classifications.

### concept-02-area-drilldown.png

State 2.

Shows navigation into one selected architecture area and a focused graph of
the relevant modules.

Illustrates persistent Back/breadcrumb navigation, reduced graph density,
selection, mini-map/zoom and contextual area explanation.

### concept-03-entity-focus.png

State 3.

Shows navigation from an area into one selected module/entity while
preserving architectural context and Architectural Explanation.

### concept-04-evidence-view.png

State 4.

Shows navigation from an architectural statement to evidence and
highlighted source while retaining architecture context.

## Important

These concepts specify UX direction, not recovered architectural truth.

Prefer:

existing deterministic information
    +
better hierarchy
    +
progressive disclosure
    +
clear navigation

over introducing new architectural inference merely to reproduce the
mockups visually.
