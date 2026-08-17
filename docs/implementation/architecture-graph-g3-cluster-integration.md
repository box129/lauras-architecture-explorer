# G3 deterministic cluster integration

## Contract decision

`/architecture-graph` now returns `architecture-graph/v2`. The v1 structural
group and aggregate-edge fields remain available; v2 adds group kinds for
`relation_cluster`, `relation_residual`, and `module`, plus neutral G2 facts
(member count, internal/boundary counts by kind, residual flag, and algorithm).
This was versioned because consumers need to distinguish the new containment
levels rather than infer them from labels.

## Projection and hierarchy

The production graph invokes the accepted `architecture-clusters/v1`
projection and copies its membership exactly. No graph or frontend clustering
exists. A useful leaf becomes structural region → `Structural cluster N` (and,
when necessary, `Unclustered by recovered relations`) → modules. A leaf for
which G2 returns no clusters keeps the G1 structural presentation; it does not
gain an empty or giant residual box.

Residual means only that currently recovered resolved relationships did not
recover a useful deterministic cluster. It is not a claim about value,
relatedness, or architecture.

## Relations and interaction

Cluster edges are the G2 directed, per-kind, resolved-only aggregates. Calls,
inherits, and future imports remain separate and counts are relation-record
counts. Internal relations are inspector facts rather than far-zoom edges.

Select changes only selection. Expand reveals containment children. G1 Enter
and Back remain structural-scope operations. Clusters are Expand-only in G3 to
avoid coupling the established structural scope router to a new route type.
The accessible table exposes the same hierarchy, selected state, actions, and
relation direction/kind/count as the canvas.

## Validation target and limitations

The pinned Flask analysis target is commit
`6a2f545bfd8ed31e19066a299296917e034aca58`; accepted G2 evidence recovers
one root-file cluster containing `app.py`, `blueprints.py`, `cli.py`, `ctx.py`,
and `helpers.py`. The graph uses those only through G2 membership. The pinned
Tenacity and Stevedore bridge-only regions have zero clusters and therefore
retain G1 presentation.

G3 does not add semantic labels, embeddings, LLM calls, import extraction, or
new clustering behavior. Live screenshots require a clean API/UI runtime with
the external pinned checkouts; they are not substituted by fixture data.
