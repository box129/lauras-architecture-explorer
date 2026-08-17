# 5. Group / area drill-down

## Purpose

Where am I · what is in here · how do these relate · how do I go deeper · how
do I get back.

## Main area

The group's real members, inside a visible boundary of their parent region, each
card showing its **outgoing relations to other members of this same group** —
"imports email.service.js", "calls notificationEvent.service.js". This is the
gap versus `concept-02`: the old group view drew zero edges.

Rules:
- An edge renders only between two members currently in scope. Nothing outside
  is pulled in, nothing is inferred.
- A member with no in-scope relation says so: *"no outgoing relation inside
  this group"*. Silence would read as a rendering failure.
- For a Layer-2 cluster these relations **are** the reason the cluster exists —
  the same facts, not a second computation.

## Right panel

Cluster identity → AI slot → facts (modules, internal relations, origin) →
"Why these modules are grouped" as real edge triples → member list.

The disclosure is worded as *structural evidence that this cluster exists* and
never as evidence for whatever the AI named it.

## Breadcrumb

`Overview › backend › src/services › Structural cluster 1` — a Layer-2 cluster
is a legitimate crumb segment.
