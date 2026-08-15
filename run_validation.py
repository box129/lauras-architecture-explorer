#!/usr/bin/env python3
"""
Syntax Tree — Manual Validation Runner

Run this script against any repository to validate that the Extraction Engine
and Knowledge Graph are working correctly.

Usage:
    python run_validation.py /path/to/repository
    python run_validation.py /path/to/repository --verbose
    python run_validation.py /path/to/repository --output report.txt
"""

import argparse
import sys
import time
import os
from pathlib import Path
from collections import Counter

# ─── Setup ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Syntax Tree validation runner")
    parser.add_argument("repository", help="Path to the repository to analyze")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    parser.add_argument("--output", "-o", help="Write report to file instead of stdout")
    parser.add_argument("--db", help="Path for SQLite database (default: in-memory)", default=":memory:")
    parser.add_argument("--spot-check", type=int, default=10, help="Number of functions to spot-check (default: 10)")
    args = parser.parse_args()

    repo_path = os.path.abspath(args.repository)
    if not os.path.isdir(repo_path):
        print(f"Error: {repo_path} is not a directory")
        sys.exit(1)

    output = open(args.output, "w") if args.output else sys.stdout
    verbose = args.verbose

    def log(msg=""):
        output.write(msg + "\n")

    def section(title):
        log(f"\n{'='*70}")
        log(f"  {title}")
        log(f"{'='*70}\n")

    # ─── Import subsystems ────────────────────────────────────────────────

    try:
        from syntax_tree.pipeline.orchestrator import PipelineOrchestrator
        from syntax_tree.graph import KnowledgeGraph, KnowledgeGraphConfig
    except ImportError as e:
        print(f"Import error: {e}")
        print("Make sure you're running from the project root with poetry:")
        print("  poetry run python run_validation.py /path/to/repo")
        sys.exit(1)

    # ═════════════════════════════════════════════════════════════════════
    # PHASE 1: EXTRACTION
    # ═════════════════════════════════════════════════════════════════════

    section("PHASE 1: EXTRACTION ENGINE")

    log(f"Repository: {repo_path}")
    log(f"Starting extraction...")
    log()

    # Track progress
    progress_events = []
    def on_progress(event, data):
        progress_events.append((event, data))
        if event == "discovery_complete":
            log(f"  Discovered {data['total_files']} files")
        elif event == "file_parsed" and verbose:
            log(f"  Parsed: {data['file_path']} ({data['current']}/{data['total']})")
        elif event == "resolution_complete":
            log(f"  Resolution: {data['resolved']} resolved, {data['unresolved']} unresolved")
        elif event == "pipeline_complete":
            log(f"  Pipeline completed in {data['duration_seconds']:.2f}s")

    from syntax_tree.config import ExtractionConfig
    config = ExtractionConfig(progress_callback=on_progress)
    orchestrator = PipelineOrchestrator(config)

    extraction_start = time.monotonic()
    try:
        result = orchestrator.extract(repo_path)
    except Exception as e:
        log(f"\nEXTRACTION FAILED: {type(e).__name__}: {e}")
        sys.exit(1)
    extraction_time = time.monotonic() - extraction_start

    # ─── Extraction Stats ─────────────────────────────────────────────

    section("EXTRACTION RESULTS")

    stats = result.stats
    log(f"  Total files discovered:  {stats.total_files_discovered}")
    log(f"  Files parsed:            {stats.files_parsed}")
    log(f"  Files skipped:           {stats.files_skipped}")
    log(f"  Files with errors:       {stats.files_with_errors}")
    log()
    log(f"  Total nodes:             {stats.total_nodes}")
    log(f"  Total structural edges:  {stats.total_edges}")
    log(f"  Total call sites:        {stats.total_call_sites}")
    log(f"  Resolved calls:          {stats.resolved_calls}")
    log(f"  Unresolved calls:        {stats.unresolved_calls}")
    log()
    log(f"  Extraction time:         {extraction_time:.2f}s")

    if stats.total_call_sites > 0:
        resolution_rate = stats.resolved_calls / stats.total_call_sites * 100
        log(f"  Resolution rate:         {resolution_rate:.1f}%")

    # ─── Node Breakdown ───────────────────────────────────────────────

    section("NODE BREAKDOWN")

    type_counts = Counter(n.type for n in result.nodes)
    for node_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        log(f"  {node_type:<25} {count:>6}")
    log(f"  {'TOTAL':<25} {len(result.nodes):>6}")

    # ─── Language Breakdown ───────────────────────────────────────────

    lang_counts = Counter(n.language for n in result.nodes)
    if len(lang_counts) > 1:
        log()
        log("  By language:")
        for lang, count in sorted(lang_counts.items(), key=lambda x: -x[1]):
            log(f"    {lang:<23} {count:>6}")

    # ─── Edge Breakdown ───────────────────────────────────────────────

    section("EDGE BREAKDOWN")

    all_edges = list(result.edges) + list(result.resolved_edges)
    edge_type_counts = Counter(e.edge_type for e in all_edges)
    for edge_type, count in sorted(edge_type_counts.items(), key=lambda x: -x[1]):
        log(f"  {edge_type:<25} {count:>6}")
    log(f"  {'TOTAL':<25} {len(all_edges):>6}")

    # ─── File Manifest ────────────────────────────────────────────────

    if verbose:
        section("FILE MANIFEST")

        status_counts = Counter(f.status for f in result.file_manifest)
        for status, count in sorted(status_counts.items()):
            log(f"  {status:<30} {count:>6}")

        skipped = [f for f in result.file_manifest if f.status != "parsed"]
        if skipped:
            log()
            log("  Skipped files:")
            for f in skipped[:20]:
                log(f"    {f.file_path} ({f.status})")
            if len(skipped) > 20:
                log(f"    ... and {len(skipped) - 20} more")

    # ─── Parse Errors ─────────────────────────────────────────────────

    if stats.parse_errors:
        section("PARSE ERRORS")
        for err in stats.parse_errors[:20]:
            log(f"  {err.file_path}:{err.line} - {err.error_type}: {err.message}")
        if len(stats.parse_errors) > 20:
            log(f"  ... and {len(stats.parse_errors) - 20} more errors")
    else:
        log("\n  No parse errors.")

    # ─── Warnings ─────────────────────────────────────────────────────

    if stats.warnings:
        section("WARNINGS")
        for w in stats.warnings[:20]:
            log(f"  {w}")
        if len(stats.warnings) > 20:
            log(f"  ... and {len(stats.warnings) - 20} more warnings")

    # ─── Unresolved References ────────────────────────────────────────

    if result.unresolved_references:
        section("UNRESOLVED REFERENCES (sample)")

        reason_counts = Counter(u.reason for u in result.unresolved_references)
        log("  By reason:")
        for reason, count in sorted(reason_counts.items(), key=lambda x: -x[1]):
            log(f"    {reason:<30} {count:>6}")
        log()

        if verbose:
            log("  Details (first 30):")
            for ref in result.unresolved_references[:30]:
                log(f"    {ref.call_site.caller_qn}")
                log(f"      calls: {ref.call_site.called_name} (line {ref.call_site.line})")
                log(f"      reason: {ref.reason}")
                if ref.attempted_path:
                    log(f"      tried: {ref.attempted_path}")
                log()

    # ═════════════════════════════════════════════════════════════════════
    # PHASE 2: KNOWLEDGE GRAPH
    # ═════════════════════════════════════════════════════════════════════

    section("PHASE 2: KNOWLEDGE GRAPH INGESTION")

    kg_config = KnowledgeGraphConfig(db_path=args.db)
    graph = KnowledgeGraph(config=kg_config)

    ingest_start = time.monotonic()
    try:
        graph.ingest(result)
    except Exception as e:
        log(f"\nINGESTION FAILED: {type(e).__name__}: {e}")
        sys.exit(1)
    ingest_time = time.monotonic() - ingest_start

    log(f"  Ingestion time:          {ingest_time:.2f}s")

    graph_stats = graph.get_stats()
    log(f"  Graph nodes:             {graph_stats['total_nodes']}")
    log(f"  Graph edges:             {graph_stats['total_edges']}")
    log(f"  Connected components:    {graph_stats['connected_component_count']}")
    log(f"  Avg in-degree:           {graph_stats['avg_in_degree']:.2f}")
    log(f"  Avg out-degree:          {graph_stats['avg_out_degree']:.2f}")

    # ─── Consistency Check ────────────────────────────────────────────

    section("CONSISTENCY CHECKS")

    checks_passed = 0
    checks_failed = 0

    def check(name, condition, detail=""):
        nonlocal checks_passed, checks_failed
        if condition:
            log(f"  PASS  {name}")
            checks_passed += 1
        else:
            log(f"  FAIL  {name}{' — ' + detail if detail else ''}")
            checks_failed += 1

    # Node count matches extraction
    check(
        "Node count matches extraction",
        graph_stats["total_nodes"] == stats.total_nodes,
        f"graph={graph_stats['total_nodes']}, extraction={stats.total_nodes}"
    )

    # Edge count matches extraction
    expected_edges = stats.total_edges + stats.resolved_calls
    check(
        "Edge count matches extraction",
        graph_stats["total_edges"] == expected_edges,
        f"graph={graph_stats['total_edges']}, expected={expected_edges}"
    )

    # Every node retrievable by QN
    sample_nodes = list(result.nodes)[:50]
    all_found = True
    missing = []
    for node in sample_nodes:
        retrieved = graph.get_node(node.qualified_name)
        if retrieved is None:
            all_found = False
            missing.append(node.qualified_name)
    check(
        f"All sampled nodes retrievable ({len(sample_nodes)} checked)",
        all_found,
        f"missing: {missing[:5]}" if missing else ""
    )

    # No duplicate qualified names
    all_qns = [n.qualified_name for n in result.nodes]
    unique_qns = set(all_qns)
    check(
        "No duplicate qualified names",
        len(all_qns) == len(unique_qns),
        f"{len(all_qns) - len(unique_qns)} duplicates found"
    )

    # All sources are "parsed"
    non_parsed = [n for n in result.nodes if n.source != "parsed"]
    check(
        "All node sources are 'parsed'",
        len(non_parsed) == 0,
        f"{len(non_parsed)} nodes with wrong source"
    )

    # Line numbers are 1-indexed
    zero_lines = [n for n in result.nodes if n.line_start < 1]
    check(
        "All line numbers >= 1",
        len(zero_lines) == 0,
        f"{len(zero_lines)} nodes with line_start < 1"
    )

    # line_end >= line_start
    bad_ranges = [n for n in result.nodes if n.line_end < n.line_start]
    check(
        "All line_end >= line_start",
        len(bad_ranges) == 0,
        f"{len(bad_ranges)} nodes with invalid line range"
    )

    # QualifiedName format check
    bad_qns = []
    for n in result.nodes:
        qn = n.qualified_name
        if n.type == "module":
            if "::" in qn:
                bad_qns.append(qn)
        else:
            if "::" not in qn and n.type not in ("database_table", "database_column", "docker_service", "k8s_service", "k8s_deployment", "environment_variable"):
                bad_qns.append(qn)
    check(
        "QualifiedName format valid",
        len(bad_qns) == 0,
        f"{len(bad_qns)} malformed QNs: {bad_qns[:3]}" if bad_qns else ""
    )

    # CALLS edges have required metadata
    calls_edges = [e for e in result.resolved_edges if e.edge_type == "CALLS"]
    from syntax_tree.models.data_models import metadata_from_tuple
    bad_calls = []
    for e in calls_edges:
        meta = metadata_from_tuple(e.metadata) if hasattr(e.metadata, '__iter__') and not isinstance(e.metadata, str) else {}
        if "line" not in meta or "resolution" not in meta:
            bad_calls.append(e)
    check(
        "All CALLS edges have line + resolution metadata",
        len(bad_calls) == 0,
        f"{len(bad_calls)} CALLS edges missing metadata"
    )

    log()
    log(f"  Results: {checks_passed} passed, {checks_failed} failed")

    # ═════════════════════════════════════════════════════════════════════
    # PHASE 3: QUERY VALIDATION
    # ═════════════════════════════════════════════════════════════════════

    section("PHASE 3: QUERY VALIDATION")

    # ─── Spot Check Functions ─────────────────────────────────────────

    log("  SPOT CHECK: Exported Functions")
    log()

    exported_funcs = graph.find_nodes(type=["function", "method"], is_exported=True)
    log(f"  Found {len(exported_funcs)} exported functions/methods")
    log()

    spot_count = min(args.spot_check, len(exported_funcs))
    for func in exported_funcs[:spot_count]:
        log(f"  {func.qualified_name}")
        log(f"    Type: {func.type} | Lines: {func.line_start}-{func.line_end} | Async: {func.is_async}")

        if func.parameters:
            params = ", ".join(
                f"{p.name}: {p.type_annotation}" if p.type_annotation else p.name
                for p in func.parameters
            )
            log(f"    Params: ({params})")

        if func.return_type:
            log(f"    Returns: {func.return_type}")

        if func.decorators:
            log(f"    Decorators: {list(func.decorators)}")

        # Show what this function calls
        callees = graph.get_neighbors(func.qualified_name, edge_types=["CALLS"], direction="outgoing")
        if callees:
            log(f"    Calls: {callees[:5]}{'...' if len(callees) > 5 else ''}")

        # Show what calls this function
        callers = graph.get_neighbors(func.qualified_name, edge_types=["CALLS"], direction="incoming")
        if callers:
            log(f"    Called by: {callers[:5]}{'...' if len(callers) > 5 else ''}")

        log()

    # ─── Most Connected Nodes ─────────────────────────────────────────

    log("  MOST CONNECTED NODES")
    log()

    if "most_connected" in graph_stats:
        for qn, degree in graph_stats["most_connected"][:10]:
            node = graph.get_node(qn)
            if node:
                log(f"    {degree:>4} edges  {node.type:<12} {node.name} ({node.file_path})")

    # ─── Traversal Test ───────────────────────────────────────────────

    log()
    log("  TRAVERSAL TEST")
    log()

    if exported_funcs:
        target = exported_funcs[0]
        log(f"  Starting from: {target.qualified_name}")

        for depth in [1, 2, 3]:
            reachable = graph.traverse(target.qualified_name, direction="outgoing", max_depth=depth)
            log(f"    Depth {depth}: {len(reachable)} nodes reachable")

        all_incoming = graph.traverse(target.qualified_name, direction="incoming", max_depth=-1)
        log(f"    All transitive callers: {len(all_incoming)}")

    # ─── Full Text Search Test ────────────────────────────────────────

    log()
    log("  FULL TEXT SEARCH TEST")
    log()

    test_queries = ["init", "error", "config", "test", "main", "process", "handle"]
    for query in test_queries:
        search_start = time.monotonic()
        results = graph.full_text_search(query, limit=5)
        search_time = time.monotonic() - search_start
        if results:
            log(f"  '{query}': {len(results)} results ({search_time*1000:.1f}ms)")
            if verbose:
                for r in results[:3]:
                    log(f"      {r.qualified_name} ({r.type})")

    # ─── Click-to-Navigate Test ───────────────────────────────────────

    log()
    log("  CLICK-TO-NAVIGATE TEST")
    log()

    # Pick a few files and test mid-file line clicks
    files_with_nodes = set(n.file_path for n in result.nodes if n.type in ("function", "method", "class"))
    test_files = list(files_with_nodes)[:5]

    for fp in test_files:
        file_nodes = graph.find_nodes(file_path=fp, type=["function", "method"])
        if file_nodes:
            target_node = file_nodes[0]
            mid_line = (target_node.line_start + target_node.line_end) // 2
            located = graph.get_node_at_location(fp, mid_line)
            if located:
                match = "MATCH" if located.qualified_name == target_node.qualified_name else "DIFFERENT"
                log(f"  {fp}:{mid_line} -> {located.name} ({located.type}) [{match}]")
            else:
                log(f"  {fp}:{mid_line} -> NOT FOUND")

    # ═════════════════════════════════════════════════════════════════════
    # PHASE 4: PERFORMANCE SUMMARY
    # ═════════════════════════════════════════════════════════════════════

    section("PERFORMANCE SUMMARY")

    # Count total lines
    total_lines = sum(f.line_count for f in result.file_manifest if f.line_count > 0)

    log(f"  Repository size:         {total_lines:,} lines of code")
    log(f"  Extraction time:         {extraction_time:.2f}s")
    log(f"  Ingestion time:          {ingest_time:.2f}s")
    log(f"  Total pipeline time:     {extraction_time + ingest_time:.2f}s")
    log()

    if total_lines > 0:
        lines_per_sec = total_lines / extraction_time if extraction_time > 0 else 0
        log(f"  Extraction throughput:    {lines_per_sec:,.0f} lines/sec")

    # Performance budget check
    log()
    log("  Budget checks:")
    if total_lines <= 10000:
        check("10k LOC budget (< 10s)", extraction_time < 10, f"took {extraction_time:.2f}s")
    elif total_lines <= 50000:
        check("50k LOC budget (< 60s)", extraction_time < 60, f"took {extraction_time:.2f}s")
    elif total_lines <= 100000:
        check("100k LOC budget (< 180s)", extraction_time < 180, f"took {extraction_time:.2f}s")

    # Query performance
    log()
    log("  Query performance (single calls):")

    t = time.monotonic()
    graph.get_node(result.nodes[0].qualified_name if result.nodes else "nonexistent")
    log(f"    get_node:              {(time.monotonic()-t)*1000:.2f}ms")

    t = time.monotonic()
    graph.find_nodes(type="function")
    log(f"    find_nodes(type):      {(time.monotonic()-t)*1000:.2f}ms")

    t = time.monotonic()
    graph.get_edge_tuples()
    log(f"    get_edge_tuples(all):  {(time.monotonic()-t)*1000:.2f}ms")

    if result.nodes:
        t = time.monotonic()
        graph.traverse(result.nodes[0].qualified_name, direction="outgoing", max_depth=3)
        log(f"    traverse(3 hops):      {(time.monotonic()-t)*1000:.2f}ms")

    t = time.monotonic()
    graph.full_text_search("function")
    log(f"    full_text_search:      {(time.monotonic()-t)*1000:.2f}ms")

    t = time.monotonic()
    graph.get_stats()
    log(f"    get_stats:             {(time.monotonic()-t)*1000:.2f}ms")

    # ═════════════════════════════════════════════════════════════════════
    # SUMMARY
    # ═════════════════════════════════════════════════════════════════════

    section("FINAL SUMMARY")

    log(f"  Repository:              {repo_path}")
    log(f"  Lines of code:           {total_lines:,}")
    log(f"  Entities extracted:      {stats.total_nodes}")
    log(f"  Relationships found:     {len(all_edges)}")
    log(f"  Call resolution rate:    {resolution_rate:.1f}%" if stats.total_call_sites > 0 else "  Call resolution rate:    N/A")
    log(f"  Total time:              {extraction_time + ingest_time:.2f}s")
    log(f"  Consistency checks:      {checks_passed} passed, {checks_failed} failed")
    log()

    if checks_failed > 0:
        log("  STATUS: ISSUES FOUND — review failures above")
    else:
        log("  STATUS: ALL CHECKS PASSED")

    log()

    # Cleanup
    graph.close()
    if args.output:
        output.close()
        print(f"Report written to {args.output}")


if __name__ == "__main__":
    main()