import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FolderBrowserDialog from './FolderBrowserDialog';

/**
 * Participant 1 formative usability finding: "I would love it if i didn't
 * only have to copy the file path... you could make the application open
 * file exploerer and i could easily navigate to the folder I want from
 * there." Covers the modal folder browser backing that request.
 */
const fetchApiMock = vi.fn();
vi.mock('../../api/client', () => ({
  fetchApi: (...args: unknown[]) => fetchApiMock(...args),
}));

afterEach(() => {
  fetchApiMock.mockReset();
});

describe('FolderBrowserDialog', () => {
  it('loads starting locations with no path and lets the user select one to confirm', async () => {
    fetchApiMock.mockResolvedValueOnce({
      path: null,
      parent: null,
      directories: [
        { name: 'Home (lenovo)', path: 'C:\\Users\\lenovo' },
        { name: 'C:\\', path: 'C:\\' },
      ],
    });
    fetchApiMock.mockResolvedValueOnce({
      path: 'C:\\Users\\lenovo',
      parent: 'C:\\Users',
      directories: [{ name: 'repos', path: 'C:\\Users\\lenovo\\repos' }],
    });
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<FolderBrowserDialog onCancel={vi.fn()} onSelect={onSelect} />);

    await screen.findByText('Home (lenovo)');
    await user.click(screen.getByText('Home (lenovo)'));

    await screen.findByText('repos');
    await user.click(screen.getByRole('button', { name: /use this folder/i }));

    expect(onSelect).toHaveBeenCalledWith('C:\\Users\\lenovo');
  });

  it('does nothing harmful on Cancel -- no selection callback fires', async () => {
    fetchApiMock.mockResolvedValueOnce({ path: null, parent: null, directories: [] });
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSelect = vi.fn();

    render(<FolderBrowserDialog onCancel={onCancel} onSelect={onSelect} />);
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows an honest error instead of a silent failure when listing fails', async () => {
    fetchApiMock.mockRejectedValueOnce(new Error('Permission denied: C:\\Windows\\System32\\config'));

    render(<FolderBrowserDialog onCancel={vi.fn()} onSelect={vi.fn()} />);

    expect(await screen.findByText(/permission denied/i)).toBeInTheDocument();
  });

  it('disables "Use this folder" until a folder has actually been reached', async () => {
    fetchApiMock.mockResolvedValueOnce({
      path: null,
      parent: null,
      directories: [{ name: 'Home (lenovo)', path: 'C:\\Users\\lenovo' }],
    });

    render(<FolderBrowserDialog onCancel={vi.fn()} onSelect={vi.fn()} />);
    await screen.findByText('Home (lenovo)');

    expect(screen.getByRole('button', { name: /use this folder/i })).toBeDisabled();
  });
});
