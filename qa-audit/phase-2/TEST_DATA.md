# Phase 2 Test Data

All repositories below were created for this audit under `qa-audit/phase-2/fixtures/` and had not been analyzed before Phase 2 began. They are immutable local fixtures rather than external clones, so their identity is recorded as a deterministic manifest digest: sort files by relative path, calculate each file's SHA-256, join lines as `<hash><two spaces><relative-path>\n`, then SHA-256 the UTF-8 manifest.

| Fixture | Scope | Files | Manifest SHA-256 |
|---|---|---:|---|
| `python-nested` | Small Python; nested package, classes, functions, imports, and calls | 6 | `38a3b1c6f84603b5bbb8153c3bb7b592c06b355af91612458e10629ac7eb0a6f` |
| `typescript-small` | Small TypeScript; parser, analyzer, docs, types, imports, and calls | 6 | `96bc7b0ac0ad41f8e9b6a3bb6bf84f2ecef0b200ff0710c49b732448db29c58c` |
| `mixed-moderate` | Mixed Python/TypeScript; domain, service, repository, API, reporting, frontend store/controller | 18 | `3ab85911ffb98f1221a3df7e5cfbd41390ebe513ced5c24bf55d6a540f66def7` |

The full source of each fixture is retained in the fixture directory. No application repository, bundled demo, or previously analyzed project was used as acceptance test data.

## Objective source checks selected before execution

- Python: `Parser`, `parse_document`, `AnalysisService`, and the call from the service into the parser.
- TypeScript: `Parser`, `Analyzer`, documentation generator, and imports from the entry module.
- Mixed: `TaskService`, validator, repository, error types, reporting, API entry point, and frontend controller/store relationships.

These targets were intended for the graph, documentation, and search comparisons. The UI exposed zero graph nodes, zero component hierarchy items, and zero search results, so no claimed component output could be credited as matching source.
