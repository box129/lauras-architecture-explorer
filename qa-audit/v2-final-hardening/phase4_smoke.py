"""Phase 4 smoke sequence driver. Hits the REAL, normally-configured
backend (env-var-driven Phase 3 config, no app.state test injection) and
records the stats the task brief asks for. Labelled explicitly: the
provider behind SYNTAX_TREE_ARCH_EXPLANATION_LLM_BASE_URL in this run is
qa-audit/v2-vertical-slice/scripts/fake_llm_server.py, a local stand-in --
NOT a real external LLM. No real provider credentials were available in
this environment (checked via `env | grep -i OPENROUTER/BLACKBOX` and the
PowerShell equivalent -- both empty), so this script exists to prove the
Phase 3 config path and record wiring-level stats, not to claim live
validation.
"""
import json
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8301/api"

attempts = []


def call(label, entity_id, run_id):
    started = time.monotonic()
    req = urllib.request.Request(
        f"{BASE}/entities/{entity_id}/architectural-explanation?run_id={run_id}",
        data=b"{}",
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            latency_ms = int((time.monotonic() - started) * 1000)
            body = json.loads(resp.read().decode("utf-8"))
            attempts.append({
                "label": label,
                "entity_id": entity_id,
                "status": resp.status,
                "latency_ms": latency_ms,
                "claim_count": len(body["claims"]),
                "supported_count": body["supported_count"],
                "insufficient_evidence_count": body["insufficient_evidence_count"],
                "error": None,
            })
            print(f"[{label}] {entity_id} -> {resp.status} {latency_ms}ms "
                  f"claims={len(body['claims'])} supported={body['supported_count']} "
                  f"insufficient={body['insufficient_evidence_count']}")
    except Exception as exc:  # noqa: BLE001 - smoke script, record and continue
        latency_ms = int((time.monotonic() - started) * 1000)
        attempts.append({
            "label": label, "entity_id": entity_id, "status": None,
            "latency_ms": latency_ms, "claim_count": None,
            "supported_count": None, "insufficient_evidence_count": None,
            "error": str(exc),
        })
        print(f"[{label}] {entity_id} -> ERROR {exc}")


if __name__ == "__main__":
    targets = json.loads(sys.argv[1])  # list of {label, entity_id, run_id}
    for t in targets:
        call(t["label"], t["entity_id"], t["run_id"])
    print("---SUMMARY---")
    print(json.dumps(attempts, indent=2))
