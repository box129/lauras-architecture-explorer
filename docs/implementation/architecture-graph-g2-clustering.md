# G2A deterministic architecture clustering

## Scope

G2A adds the backend-only `architecture-clusters/v1` contract. It does not
change the accepted G1 ReactFlow graph, inspector, layout, verifier semantics,
or any frontend DTO. A cluster is a derived structural abstraction, never a
verified or supported architectural proposition and never an AI label.

## Input and region eligibility

The input is the persisted `ObservedProgramRelation` set for one analysis run.
Only a relation with `resolution_status == "resolved"` and concrete source and
target entity ids is considered. The source and target symbols are mapped to
their static file/module component ids. Current real producers are `calls` and
`inherits`; the contract preserves all declared relation kinds so a future
reliably-produced `imports` relation can participate without a schema change.

Clustering is performed only once for every *leaf* of G1's deterministic
containment hierarchy: a group with direct module members and no child groups.
Containers are not clustered, so a module cannot be re-clustered repeatedly at
each ancestor. The containing structural-group id is retained as authoritative
provenance. If the G1 containment hierarchy is ineligible, this projection is
empty rather than inventing repository-wide groups.

## Selected method

`bridge-separated-affinity-components/v1` is a dependency-free deterministic
method. Within one eligible leaf region it projects each distinct resolved
module pair to one undirected affinity edge. Direction and relation kinds are
not changed in the underlying facts; the undirected projection is only used to
find topology. Tarjan bridge detection removes any edge whose removal separates
the affinity graph, then takes components of the remaining topology.

A recovered cluster needs at least three modules. This favors internally
cohesive relation cores and prevents a single connector relation, a sparse pair,
or a star hub from becoming a purported group. Persisted relation-record counts
are deliberately not affinity weights: repeated observations are retained as
provenance/counts, not treated as a semantic strength multiplier. This avoids
arbitrary relation-kind weights and makes the membership rule easy to reproduce.

Alternatives assessed:

- Connected components: deterministic and cheap, but a single bridge/hub joins
  otherwise distinct areas; used only as the baseline rejected for membership.
- Greedy modularity/Louvain: can subdivide medium dense regions, but would need
  an additional graph dependency or a more complex custom tie-break contract;
  its objective and resolution choices are less directly auditable here.
- Label propagation: lightweight but ordering/tie sensitivity and hub collapse
  make it a poor default for a first deterministic contract.

## Residuals and provenance

Every eligible region gets an explicit residual record. Residual means only
that available internal resolved relations did not place that module in a useful
non-bridge core; it does not mean architecturally unrelated. `member_reasons`
states whether a member had no internal resolved relation or was only
bridge-connected/below the minimum core. Regions that are too small or have no
internal resolved relations have their own exact reason.

Each cluster records sorted member ids, internal and boundary persisted-relation
counts by original kind, and sorted internal relation ids. Future G3 can use the
included `cluster_edges`: directed, per-kind aggregations with contributing
module pairs and persisted relation ids. This follows G0 aggregate-edge
semantics; no second aggregation rule is introduced.

## Determinism and identity

All traversal, inputs, components, relation ids, and display ordering are
sorted. Tarjan traversal has no random seed. A cluster id hashes the run id,
containing group id, algorithm/version, and sorted module ids. Neutral display
names (`Structural cluster 1`, etc.) are assigned only after deterministic
global ordering and are not part of identity.

## Limitations and G3 assumptions

This intentionally conservative method can return `NO_USEFUL_RELATION_CLUSTERS`
(represented by no clusters plus residuals) for a large tree/hub or a single
dense non-bridge component. It does not assign semantic names, infer imports,
or claim architectural intent. G3 may safely render only this projection's
members and provenance-derived cluster edges; it must not reinterpret residuals
or membership as verification.
