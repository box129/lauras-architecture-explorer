import { fetchApi } from '../../api/client';
import type {
  ArchExplanationSettings,
  ArchExplanationSettingsUpdate,
  ConnectionTestResult,
} from './types';

export function getArchExplanationSettings(): Promise<ArchExplanationSettings> {
  return fetchApi<ArchExplanationSettings>('/settings/architectural-explanation');
}

export function putArchExplanationSettings(
  update: ArchExplanationSettingsUpdate,
): Promise<ArchExplanationSettings> {
  return fetchApi<ArchExplanationSettings>('/settings/architectural-explanation', {
    method: 'PUT',
    body: JSON.stringify(update),
  });
}

export interface ConnectionTestRequest {
  provider?: string;
  base_url?: string;
  model?: string;
  api_key?: string | null;
}

export function testArchExplanationConnection(
  candidate: ConnectionTestRequest,
): Promise<ConnectionTestResult> {
  return fetchApi<ConnectionTestResult>('/settings/architectural-explanation/test-connection', {
    method: 'POST',
    body: JSON.stringify(candidate),
  });
}
