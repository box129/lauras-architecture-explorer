import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsPanel from './SettingsPanel';
import { useSyntaxTreeStore } from '../../store';

// Same mocking boundary as ArchitecturalExplanationPanel.test.tsx: this
// feature's api.ts is required to go through fetchApi, so mocking it here
// keeps every test backend-free.
const fetchApiMock = vi.fn();
vi.mock('../../api/client', () => {
  class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }
  return {
    fetchApi: (...args: unknown[]) => fetchApiMock(...args),
    ApiError: MockApiError,
  };
});

afterEach(() => {
  fetchApiMock.mockReset();
  useSyntaxTreeStore.getState().closeSettings();
});

const DISABLED_UNSET = {
  enabled: false,
  provider: 'off',
  base_url: '',
  model: '',
  configured: false,
  credentials_present: false,
  credential_source: 'unset',
  config_source: 'unset',
};

describe('SettingsPanel', () => {
  it('renders nothing when closed', () => {
    fetchApiMock.mockResolvedValueOnce(DISABLED_UNSET);
    render(<SettingsPanel />);
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('loads and displays the current settings when opened', async () => {
    fetchApiMock.mockResolvedValueOnce({
      ...DISABLED_UNSET,
      enabled: true,
      provider: 'openrouter',
      model: 'some/model',
      configured: true,
      credentials_present: true,
      credential_source: 'environment',
      config_source: 'environment',
    });
    useSyntaxTreeStore.getState().openSettings();

    render(<SettingsPanel />);

    expect(await screen.findByDisplayValue('some/model')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /enable architectural explanations/i })).toBeChecked();
    expect(screen.getByText(/from an environment variable/i)).toBeInTheDocument();
  });

  it('saves the form and shows confirmation', async () => {
    fetchApiMock.mockResolvedValueOnce(DISABLED_UNSET);
    useSyntaxTreeStore.getState().openSettings();
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await screen.findByRole('switch', { name: /enable architectural explanations/i });

    await user.click(screen.getByRole('switch', { name: /enable architectural explanations/i }));
    await user.selectOptions(screen.getByLabelText('Provider'), 'openrouter');
    await user.type(screen.getByLabelText('Model'), 'anthropic/claude-sonnet-4.6');
    await user.type(screen.getByLabelText('API Key'), 'sk-test-key');

    fetchApiMock.mockResolvedValueOnce({
      ...DISABLED_UNSET,
      enabled: true,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.6',
      configured: true,
      credentials_present: true,
      credential_source: 'runtime',
      config_source: 'runtime',
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
    const [, putOptions] = fetchApiMock.mock.calls[1];
    const body = JSON.parse(putOptions.body);
    expect(body).toMatchObject({
      enabled: true,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4.6',
      api_key: 'sk-test-key',
    });
  });

  it('never re-sends a previously-saved key when the field is left untouched', async () => {
    fetchApiMock.mockResolvedValueOnce({
      ...DISABLED_UNSET,
      enabled: true,
      provider: 'openrouter',
      model: 'm',
      configured: true,
      credentials_present: true,
      credential_source: 'runtime',
      config_source: 'runtime',
    });
    useSyntaxTreeStore.getState().openSettings();
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await screen.findByDisplayValue('m');

    // Change only the model, never touch the API Key field.
    const modelInput = screen.getByLabelText('Model');
    await user.clear(modelInput);
    await user.type(modelInput, 'new-model');

    fetchApiMock.mockResolvedValueOnce({
      ...DISABLED_UNSET,
      enabled: true,
      provider: 'openrouter',
      model: 'new-model',
      configured: true,
      credentials_present: true,
      credential_source: 'runtime',
      config_source: 'runtime',
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(2));
    const [, putOptions] = fetchApiMock.mock.calls[1];
    const body = JSON.parse(putOptions.body);
    expect(body.api_key).toBeNull();
    // The masked placeholder text never contains the real key.
    expect(document.body.textContent).not.toContain('sk-test-key');
  });

  it('shows the test-connection result and never echoes the key back', async () => {
    fetchApiMock.mockResolvedValueOnce(DISABLED_UNSET);
    useSyntaxTreeStore.getState().openSettings();
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await screen.findByRole('switch', { name: /enable architectural explanations/i });
    await user.selectOptions(screen.getByLabelText('Provider'), 'openrouter');
    await user.type(screen.getByLabelText('API Key'), 'sk-super-secret');

    fetchApiMock.mockResolvedValueOnce({
      status: 'invalid_credentials',
      message: 'The provider rejected the credentials (HTTP 401).',
      latency_ms: null,
      model_used: null,
    });
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(await screen.findByText(/rejected the API key/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('sk-super-secret');
  });

  it('distinguishes a successful connection test from an unsaved/unenabled configuration', async () => {
    fetchApiMock.mockResolvedValueOnce(DISABLED_UNSET);
    useSyntaxTreeStore.getState().openSettings();
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await screen.findByRole('switch', { name: /enable architectural explanations/i });
    await user.selectOptions(screen.getByLabelText('Provider'), 'openai');
    await user.type(screen.getByLabelText('API Key'), 'sk-test-key');

    fetchApiMock.mockResolvedValueOnce({
      status: 'success',
      message: 'Connected successfully.',
      latency_ms: 250,
      model_used: 'gpt-5.4-mini',
    });
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(await screen.findByText(/Connected successfully/i)).toBeInTheDocument();
    // A passing connection test must not read as "saved" or "enabled" --
    // the form is still dirty (Enabled was never toggled on, and Save was
    // never clicked), so the UI must say so explicitly.
    expect(
      screen.getByText(/did not save or enable anything/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('Settings saved.')).not.toBeInTheDocument();
  });

  it('shows an unsaved-changes hint after editing, and clears it once saved', async () => {
    fetchApiMock.mockResolvedValueOnce(DISABLED_UNSET);
    useSyntaxTreeStore.getState().openSettings();
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await screen.findByRole('switch', { name: /enable architectural explanations/i });

    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Provider'), 'openai');
    expect(await screen.findByText(/unsaved changes/i)).toBeInTheDocument();

    fetchApiMock.mockResolvedValueOnce({
      ...DISABLED_UNSET,
      provider: 'openai',
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Settings saved.');
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
  });

  it('closing and reopening reloads fresh settings from the server', async () => {
    fetchApiMock.mockResolvedValueOnce(DISABLED_UNSET);
    useSyntaxTreeStore.getState().openSettings();
    render(<SettingsPanel />);
    await screen.findByRole('switch', { name: /enable architectural explanations/i });

    useSyntaxTreeStore.getState().closeSettings();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument());

    fetchApiMock.mockResolvedValueOnce(DISABLED_UNSET);
    useSyntaxTreeStore.getState().openSettings();
    await screen.findByRole('switch', { name: /enable architectural explanations/i });
    expect(fetchApiMock).toHaveBeenCalledTimes(2);
  });
});
