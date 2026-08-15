import { ChevronDown, Copy } from 'lucide-react';
import { useState } from 'react';

interface RunPickerProps {
  runId: string;
  freshness: string;
  lastScanned: string;
}

/**
 * Claude Design UX audit finding F05: this control previously led with the
 * raw run id ("Run run:1f7f34f034dc4674a8f395f29adb58ee") as its most
 * prominent text, right after the user's first action -- unexplained raw
 * pipeline identifiers in the primary header position, contradicting the
 * product's own "guided progress, no pipeline jargon" first-screen promise.
 *
 * The run id is real, useful provenance/debugging information and is not
 * deleted -- it stays available, just no longer primary: `lastScanned`
 * (e.g. "active run") is now the prominent label, and the id is shown
 * abbreviated with the full value available via the native title tooltip
 * and an explicit copy action.
 */
function abbreviateRunId(runId: string): string {
  const hex = runId.startsWith('run:') ? runId.slice(4) : runId;
  return hex.length > 8 ? `${hex.slice(0, 8)}…` : hex;
}

export default function RunPicker({ runId, freshness, lastScanned }: RunPickerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(runId).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="obs-run-picker" aria-label="Current analysis run">
      <button className="obs-run-picker__button" type="button" title={`Full run id: ${runId}`}>
        <span className="obs-run-picker__dot" />
        <span className="obs-run-picker__age">{lastScanned}</span>
        <span className="obs-run-picker__id" aria-label={`Run id ${runId}`}>
          {abbreviateRunId(runId)}
        </span>
        <ChevronDown size={13} strokeWidth={1.8} />
      </button>
      <button className="obs-run-picker__freshness" type="button">
        {freshness}
        <ChevronDown size={13} strokeWidth={1.8} />
      </button>
      <button
        className="obs-run-picker__copy"
        type="button"
        aria-label="Copy full run id"
        title={runId}
        onClick={handleCopy}
      >
        <Copy size={12} strokeWidth={1.8} />
        {copied && <span className="obs-run-picker__copied">Copied</span>}
      </button>
    </div>
  );
}
