# G4: optional AI interpretation for architecture clusters

G4 adds an on-demand interpretation layer over the accepted G2/G3 deterministic cluster projection.

## Boundary

Deterministic code owns source parsing, resolved relation extraction, structural regions, cluster membership, relation counts, edges, and verifier status. The model receives a fixed cluster and cannot write any of those values. Its output is labelled `AI interpretation` and is never a verified claim.

## Model input

The request is bounded to the selected run and cluster: cluster ID, containing structural-region path, member source/module paths, deterministic internal and boundary relation counts by kind, and up to 100 resolved directed member-to-member relationships. No repository prose, README, embeddings, retrieval, or full repository is sent.

## Output contract

`ClusterInterpretation { cluster_id, label, description, provider, model }`

The model must return JSON containing a short 2–6 word label and one concise description paragraph. The service validates the shape and length before returning it.

## Failure semantics

Disabled or unconfigured AI, missing credentials, provider/network/timeout errors, and malformed output return `status: unavailable` with no interpretation. The deterministic graph remains available. Unknown or cross-run cluster IDs are rejected with 404.

## UI distinction

The inspector keeps `Structural cluster N` as the deterministic identity, always shows membership, relation counts, and containing region, and shows generated label/description only with an `AI interpretation` label. No verified/green styling is used.

## Persistence and limitations

Interpretations are generated on demand and held in the current inspector session; no new persistence subsystem was added. A generated label is an aid to orientation, not an architectural fact, and quality depends on the bounded recovered relations and configured provider.

