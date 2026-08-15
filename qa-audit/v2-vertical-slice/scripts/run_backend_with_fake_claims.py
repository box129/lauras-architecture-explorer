"""Bootstrap: run the real backend app in-process with two explicit,
independent overrides via app.state (the SAME injection hooks the test
suite already uses -- api/routes/query.py's _model(request) and
api/routes/architectural_explanation.py's _proposer(request) both check
request.app.state.* before falling back to env-based settings):

  - app.state.investigation_model = NoConfiguredModel()
    Forces architecture-map / system-overview generation to stay on its
    deterministic, no-LLM fallback path (build_static_structure), no
    matter what OPENROUTER_* env vars are set process-wide. This keeps
    real browser navigation (module -> symbol drilldown) working exactly
    as already verified with live LLM config fully absent.

  - app.state.claim_proposer = LLMClaimProposer(OpenAICompatibleInvestigationModel(...))
    pointed at a local fake OpenAI-compatible HTTP server (fake_llm_server.py,
    started as a subprocess by this script), so the architectural-explanation
    endpoint's claim proposal step exercises the REAL HTTP-calling
    OpenAICompatibleInvestigationModel code path -- not a real external LLM
    provider. This is NOT live LLM validation; it proves the wiring only.

This lets a single running backend process serve both: deterministic
navigation, and a claim proposer that returns real (fake-server-sourced)
candidate propositions for the deterministic verifier to check.
"""
import os
import subprocess
import sys
import time

sys.path.insert(0, r"C:\Users\LENOVO T14\Development\lauras-v2-integration\syntax-tree-refurbished-backend\src")

FAKE_LLM_PORT = 8902
BACKEND_PORT = 8301

fake_server_proc = subprocess.Popen(
    [sys.executable, r"C:\Users\LENOVO T14\.claude\jobs\6777747f\tmp\fake_llm_server.py", str(FAKE_LLM_PORT)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1)

os.environ["OPENROUTER_API_KEY"] = "local-fake-not-a-real-key"
os.environ["OPENROUTER_BASE_URL"] = f"http://127.0.0.1:{FAKE_LLM_PORT}/v1"
os.environ["OPENROUTER_MODEL"] = "fake-local-test-model"

from syntax_tree_refurbished.api.app import create_app
from syntax_tree_refurbished.app.architectural_explanation.llm_claim_proposer import LLMClaimProposer
from syntax_tree_refurbished.app.investigation.llm_model import (
    NoConfiguredModel,
    OpenAICompatibleInvestigationModel,
)
from syntax_tree_refurbished.config import Settings

settings = Settings(environment="development")
app = create_app(settings)

app.state.investigation_model = NoConfiguredModel()

fake_model_settings = Settings(environment="development", llm_provider="openrouter")
fake_model = OpenAICompatibleInvestigationModel(fake_model_settings)
app.state.claim_proposer = LLMClaimProposer(fake_model)

print(f"[bootstrap] investigation_model pinned to NoConfiguredModel (deterministic map)", file=sys.stderr)
print(f"[bootstrap] claim_proposer pinned to LLMClaimProposer(fake server on :{FAKE_LLM_PORT})", file=sys.stderr)

import uvicorn

try:
    uvicorn.run(app, host="127.0.0.1", port=BACKEND_PORT, log_level="info")
finally:
    fake_server_proc.terminate()
