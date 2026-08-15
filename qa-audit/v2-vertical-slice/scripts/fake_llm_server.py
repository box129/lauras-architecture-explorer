"""Tiny local OpenAI-compatible fake server for the V2 vertical-slice
Chromium acceptance run. NOT a real LLM provider -- exists only so the
backend's real OpenAICompatibleInvestigationModel code path (real HTTP
call, real JSON parsing) can be exercised end-to-end in a live browser
run without an actual external API key. This must never be reported as
"live LLM validation" -- it proves the wiring, not the model.
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8901

# Filled in per-request by inspecting the prompt for real entity ids the
# proposer was actually shown (so proposals reference real, in-evidence
# ids regardless of which entity/run this is asked about).
import re


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        body = json.loads(raw.decode("utf-8"))
        prompt_text = " ".join(m["content"] for m in body.get("messages", []))

        ids = re.findall(r'id="(symbol:[^"]+)"', prompt_text)
        target_match = re.search(r"target_entity_id:\s*(symbol:\S+)", prompt_text)
        target_id = target_match.group(1) if target_match else (ids[0] if ids else None)
        other_ids = [i for i in dict.fromkeys(ids) if i != target_id]

        # Parse real observed relation lines out of the prompt (the
        # LLMClaimProposer includes evidence.relations verbatim -- see
        # _build_messages). Proposing a genuinely-observed resolved "calls"
        # relation lets the deterministic verifier come back SUPPORTED,
        # exercising that path honestly (the fake server is reading real
        # relation facts it was shown, not fabricating a match by luck).
        resolved_calls = re.findall(
            r'source_entity_id="(symbol:[^"]+)" relation_kind="calls" '
            r'target_entity_id="(symbol:[^"]+)"[^\n]*resolution_status="resolved"',
            prompt_text,
        )

        proposals = []
        true_pair = next(((s, t) for s, t in resolved_calls if s == target_id), None)
        if true_pair:
            proposals.append(
                {
                    "proposition": {
                        "kind": "direct_relation",
                        "subject_entity_id": true_pair[0],
                        "relation_kind": "calls",
                        "object_entity_id": true_pair[1],
                    },
                    "proposed_statement": "candidate direct call sourced from an observed relation",
                }
            )
        # A second, deliberately unverified candidate: target_id "calls" some
        # other in-evidence entity that was NOT among the observed resolved
        # relations above -- the deterministic verifier should return
        # insufficient_evidence for this one.
        false_target = next(
            (i for i in other_ids if not true_pair or i != true_pair[1]),
            other_ids[0] if other_ids else None,
        )
        if target_id and false_target:
            proposals.append(
                {
                    "proposition": {
                        "kind": "direct_relation",
                        "subject_entity_id": target_id,
                        "relation_kind": "calls",
                        "object_entity_id": false_target,
                    },
                    "proposed_statement": "candidate direct call (not confirmed by any observed relation)",
                }
            )

        content = json.dumps({"proposals": proposals})
        reply = {
            "id": "fake-completion-1",
            "model": "fake-local-test-model",
            "choices": [{"message": {"role": "assistant", "content": content}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 10},
        }
        data = json.dumps(reply).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write("[fake-llm] " + (fmt % args) + "\n")


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"fake LLM server listening on 127.0.0.1:{PORT}")
    server.serve_forever()
