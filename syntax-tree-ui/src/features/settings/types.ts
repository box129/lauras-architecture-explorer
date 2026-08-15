export type ConfigSource = 'runtime' | 'environment' | 'unset';

export interface ArchExplanationSettings {
  enabled: boolean;
  provider: string;
  base_url: string;
  model: string;
  configured: boolean;
  credentials_present: boolean;
  credential_source: ConfigSource;
  config_source: ConfigSource;
}

export interface ArchExplanationSettingsUpdate {
  enabled: boolean;
  provider: string;
  base_url: string;
  model: string;
  api_key?: string | null;
  clear_api_key?: boolean;
}

export type ConnectionTestStatus =
  | 'success'
  | 'invalid_credentials'
  | 'provider_unreachable'
  | 'timeout'
  | 'invalid_model'
  | 'malformed_response'
  | 'not_configured'
  | 'error';

export interface ConnectionTestResult {
  status: ConnectionTestStatus;
  message: string;
  latency_ms: number | null;
  model_used: string | null;
}

export const PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'off', label: 'Disabled (no provider)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'blackbox', label: 'Blackbox' },
];

export const CONNECTION_TEST_COPY: Record<ConnectionTestStatus, string> = {
  success: 'Connected successfully.',
  invalid_credentials: 'The provider rejected the API key. Check the key and try again.',
  provider_unreachable: 'Could not reach the provider. Check the base URL and your network connection.',
  timeout: 'The provider did not respond in time. It may be overloaded, or unreachable.',
  invalid_model: 'The provider does not recognize this model id.',
  malformed_response: 'The provider responded, but not in the expected format.',
  not_configured: 'Choose a provider before testing the connection.',
  error: 'The connection test failed.',
};
