import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSyntaxTreeStore } from '../../store';
import { ApiError } from '../../api/client';
import { getArchExplanationSettings, putArchExplanationSettings, testArchExplanationConnection } from './api';
import { invalidateArchitecturalExplanationCache } from '../architectural-explanation/api';
import { CONNECTION_TEST_COPY, PROVIDER_OPTIONS } from './types';
import type { ArchExplanationSettings, ConnectionTestResult } from './types';

const MASKED_PLACEHOLDER = '••••••••••••';

/**
 * Real end-user Settings screen for the architectural-explanation LLM
 * configuration (product-hardening round, PHASE 2). Talks to
 * GET/PUT /api/settings/architectural-explanation and
 * POST .../test-connection -- see api/routes/settings.py for the
 * credential-safety contract this UI relies on (the API key is never
 * returned by GET; this component never round-trips a value it did not
 * itself just receive from the user in this session).
 */
export default function SettingsPanel() {
  const open = useSyntaxTreeStore((s) => s.settingsOpen);
  const close = useSyntaxTreeStore((s) => s.closeSettings);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ArchExplanationSettings | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState('off');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyTouched, setApiKeyTouched] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setSaveOk(false);
    setSaveError(null);
    setTestResult(null);
    getArchExplanationSettings()
      .then((data) => {
        if (cancelled) return;
        setSaved(data);
        setEnabled(data.enabled);
        setProvider(data.provider === 'off' ? 'off' : data.provider);
        setBaseUrl(data.base_url);
        setModel(data.model);
        setApiKeyInput('');
        setApiKeyTouched(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Could not load settings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const credentialsPresent = saved?.credentials_present ?? false;

  // True whenever the on-screen form no longer matches what the backend
  // actually has saved -- e.g. right after a successful "Test connection"
  // but before "Save" is clicked. Drives the unsaved-changes hint below,
  // since a passing connection test is not itself a saved/enabled state.
  const isDirty =
    !loading &&
    !!saved &&
    (enabled !== saved.enabled ||
      provider !== (saved.provider === 'off' ? 'off' : saved.provider) ||
      baseUrl !== saved.base_url ||
      model !== saved.model ||
      apiKeyTouched);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testArchExplanationConnection({
        provider,
        base_url: baseUrl,
        model,
        api_key: apiKeyTouched ? apiKeyInput : null,
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        status: 'error',
        message: err instanceof ApiError ? err.message : 'The connection test could not run.',
        latency_ms: null,
        model_used: null,
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const result = await putArchExplanationSettings({
        enabled,
        provider,
        base_url: baseUrl,
        model,
        api_key: apiKeyTouched ? apiKeyInput || null : null,
      });
      setSaved(result);
      setApiKeyInput('');
      setApiKeyTouched(false);
      setSaveOk(true);
      // The provider/model/key just changed; any previously cached
      // explanation was generated under the OLD configuration and must
      // not be silently reused as if nothing changed.
      invalidateArchitecturalExplanationCache();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveKey() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const result = await putArchExplanationSettings({
        enabled,
        provider,
        base_url: baseUrl,
        model,
        clear_api_key: true,
      });
      setSaved(result);
      setApiKeyInput('');
      setApiKeyTouched(false);
      setSaveOk(true);
      invalidateArchitecturalExplanationCache();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not remove the saved key.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="obs-settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="obs-settings-overlay__panel">
        <header className="obs-settings__header">
          <h2>Settings</h2>
          <button type="button" aria-label="Close settings" onClick={close} className="obs-icon-button">
            <X size={18} strokeWidth={1.8} />
          </button>
        </header>

        <div className="obs-settings__body">
          <section aria-labelledby="settings-arch-explanation-heading">
            <h3 id="settings-arch-explanation-heading">Architectural Explanations</h3>
            <p className="obs-settings__hint">
              Configures the language model that proposes candidate architectural claims (for example,
              &ldquo;X calls Y&rdquo;). Every proposal is independently checked against your codebase by
              Laura&rsquo;s deterministic verifier before it is ever shown to you &mdash; the model never
              decides what is true. Repository analysis and the architecture map work fully without this
              configured.
            </p>

            {loading && <p role="status">Loading current settings&hellip;</p>}
            {loadError && (
              <p className="obs-warning obs-warning--unsupported" role="alert">
                {loadError}
              </p>
            )}

            {!loading && !loadError && (
              <div className="obs-settings__form">
                <label className="obs-settings__field obs-settings__field--toggle">
                  <span>Enabled</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    aria-label="Enable architectural explanations"
                  />
                </label>

                <label className="obs-settings__field">
                  <span>Provider</span>
                  <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="obs-settings__field">
                  <span>API Base URL</span>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://openrouter.ai/api/v1"
                    autoComplete="off"
                  />
                </label>

                <label className="obs-settings__field">
                  <span>Model</span>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. anthropic/claude-sonnet-4.6"
                    autoComplete="off"
                  />
                </label>

                <label className="obs-settings__field">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setApiKeyTouched(true);
                    }}
                    placeholder={credentialsPresent ? MASKED_PLACEHOLDER : 'Enter API key'}
                    autoComplete="off"
                    aria-describedby="settings-api-key-hint"
                  />
                </label>
                <p id="settings-api-key-hint" className="obs-settings__hint obs-settings__hint--small">
                  {credentialsPresent
                    ? `A key is saved (${saved?.credential_source === 'environment' ? 'from an environment variable' : 'entered in this Settings screen'}). Leave this blank to keep it, or type a new value to replace it.`
                    : 'Stored only in this backend process’s memory for as long as it keeps running — never written to disk, never logged, never shown again after you leave this screen.'}
                  {credentialsPresent && saved?.credential_source === 'runtime' && (
                    <>
                      {' '}
                      <button type="button" className="obs-settings__link-button" onClick={handleRemoveKey} disabled={saving}>
                        Remove saved key
                      </button>
                    </>
                  )}
                </p>

                <div className="obs-settings__actions">
                  <button type="button" onClick={handleTestConnection} disabled={testing || provider === 'off'}>
                    {testing ? 'Testing…' : 'Test connection'}
                  </button>
                  <button type="button" className="obs-settings__save" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>

                {testResult && (
                  <p
                    role="status"
                    className={`obs-warning ${testResult.status === 'success' ? 'obs-warning--success' : 'obs-warning--unsupported'}`}
                  >
                    <strong>{CONNECTION_TEST_COPY[testResult.status]}</strong>
                    {testResult.message && testResult.message !== CONNECTION_TEST_COPY[testResult.status] && (
                      <>
                        {' '}
                        {testResult.message}
                      </>
                    )}
                    {testResult.latency_ms != null && ` (${testResult.latency_ms}ms)`}
                    {testResult.status === 'success' && isDirty && (
                      <>
                        {' '}
                        This only checked the connection &mdash; it did not save or enable anything. Click{' '}
                        <strong>Save</strong> to apply these settings.
                      </>
                    )}
                  </p>
                )}
                {saveError && (
                  <p className="obs-warning obs-warning--unsupported" role="alert">
                    {saveError}
                  </p>
                )}
                {saveOk && !saveError && !isDirty && (
                  <p className="obs-warning obs-warning--success" role="status">
                    Settings saved.
                  </p>
                )}
                {!testResult && isDirty && (
                  <p className="obs-warning obs-warning--unsupported" role="status">
                    <strong>Configuration has unsaved changes.</strong> Click <strong>Save</strong> to apply them.
                  </p>
                )}

                <p className="obs-settings__hint obs-settings__hint--small">
                  Environment variables (<code>SYNTAX_TREE_ARCH_EXPLANATION_LLM_*</code>) still work as a
                  fallback whenever nothing has been saved here.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
