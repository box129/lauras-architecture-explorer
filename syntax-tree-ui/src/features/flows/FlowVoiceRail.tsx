import { ArrowLeft, BookmarkPlus, Code2, Copy, X } from 'lucide-react';
import { evidenceStatusMeta, type EvidenceStatus } from '../../design/status';
import type { CodeCompanionSelection, FlowDetailDTO, FlowStepDTO } from '../architecture-map/apiTypes';
import StatusBadge from '../observatory/StatusBadge';
import { stepProofSelection, stepStatus } from './flowProof';

interface FlowVoiceRailProps {
  flowDetail: FlowDetailDTO | null;
  selectedStep: FlowStepDTO | null;
  onClose: () => void;
  onBackToArchitecture: () => void;
  onOpenProof: (selection: CodeCompanionSelection) => void;
  onSaveLens?: () => void;
}

export default function FlowVoiceRail({
  flowDetail,
  selectedStep,
  onClose,
  onBackToArchitecture,
  onOpenProof,
  onSaveLens,
}: FlowVoiceRailProps) {
  if (!flowDetail) {
    return (
      <aside className="obs-voice obs-voice--quiet" aria-label="Flow guide">
        <p>Select a flow to see how work moves through source-backed steps.</p>
      </aside>
    );
  }

  const status = normalizeStatus(flowDetail.flow.status);
  const activeStatus = selectedStep ? stepStatus(selectedStep) : status;
  return (
    <aside className="obs-voice obs-flow-voice" aria-label={`${flowDetail.flow.name} flow explanation`}>
      <div className="obs-voice__header">
        <div>
          <div className="obs-voice__title-row">
            <h2>{selectedStep ? selectedStep.description || selectedStep.step_type : flowDetail.flow.name}</h2>
            <span className="obs-chip">
              <StatusBadge status={activeStatus} />
              {evidenceStatusMeta[activeStatus].label}
            </span>
          </div>
          <p>{selectedStep ? stepSummary(selectedStep) : flowDetail.flow.simple_explanation}</p>
          <div className="obs-voice__facts">
            <span>{flowDetail.flow.step_count} steps</span>
            <span>{flowDetail.flow.boundary_count} boundaries</span>
            <span>{flowDetail.flow.gap_count} gaps</span>
            <span>{Math.round((flowDetail.flow.confidence ?? 0) * 100)}% confidence</span>
          </div>
          <div className="obs-voice__actions">
            <button type="button" onClick={onBackToArchitecture}>
              <ArrowLeft size={14} strokeWidth={1.8} />
              Back to architecture
            </button>
            {selectedStep ? (
              <button type="button" onClick={() => onOpenProof(stepProofSelection(flowDetail, selectedStep))}>
                <Code2 size={14} strokeWidth={1.8} />
                View step proof
              </button>
            ) : (
              <button type="button" onClick={() => onOpenProof(flowProofSelection(flowDetail))}>
                <Code2 size={14} strokeWidth={1.8} />
                View flow proof
              </button>
            )}
            <button type="button" onClick={() => copyCurrentUrl()}>
              <Copy size={14} strokeWidth={1.8} />
              Copy flow link
            </button>
            {onSaveLens && (
              <button type="button" onClick={onSaveLens}>
                <BookmarkPlus size={14} strokeWidth={1.8} />
                Save Lens
              </button>
            )}
          </div>
        </div>
        <button className="obs-icon-button" type="button" aria-label="Close flow lens" onClick={onClose}>
          <X size={17} strokeWidth={1.7} />
        </button>
      </div>

      {selectedStep ? <StepDetails step={selectedStep} /> : <FlowDetails flowDetail={flowDetail} />}
    </aside>
  );
}

function FlowDetails({ flowDetail }: { flowDetail: FlowDetailDTO }) {
  return (
    <>
      <section className="obs-voice__section">
        <h3>Technical explanation</h3>
        <p>{flowDetail.flow.technical_explanation || 'No technical explanation was returned for this flow yet.'}</p>
      </section>
      <section className="obs-voice__section">
        <h3>Movement path</h3>
        <ul className="obs-step-list">
          {flowDetail.steps.map((step) => (
            <li key={step.id}>
              <StatusBadge status={stepStatus(step)} />
              <span>
                {step.description || step.step_type.replaceAll('_', ' ')}
                <small>{step.step_type.replaceAll('_', ' ')} - {step.source_span.file_path}:{step.source_span.start_line}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {flowDetail.flow.unsupported_reason && (
        <div className="obs-warning">
          <StatusBadge status="insufficient" />
          <span>{flowDetail.flow.unsupported_reason.replaceAll('_', ' ')}</span>
        </div>
      )}
    </>
  );
}

function StepDetails({ step }: { step: FlowStepDTO }) {
  const linked = step.linked_frontend_event || step.linked_api_call || step.linked_route;
  return (
    <>
      <section className="obs-voice__section">
        <h3>Step source</h3>
        <div className="obs-flow-source-card">
          <strong>{step.source_span.file_path}</strong>
          <span>Lines {step.source_span.start_line}-{step.source_span.end_line}</span>
          <small>{step.step_type.replaceAll('_', ' ')}</small>
        </div>
      </section>
      {linked && (
        <section className="obs-voice__section">
          <h3>Linked evidence</h3>
          <p>{linkedSummary(linked)}</p>
        </section>
      )}
      {step.gap_reason && (
        <div className="obs-warning">
          <StatusBadge status="insufficient" />
          <span>This call is important, but the backend could not resolve the target symbol. The source proof opens at the caller.</span>
        </div>
      )}
    </>
  );
}

function normalizeStatus(status: string): EvidenceStatus {
  return status in evidenceStatusMeta ? status as EvidenceStatus : 'insufficient';
}

function stepSummary(step: FlowStepDTO) {
  if (step.gap_reason) return 'This step is a preserved gap. The backend found important movement but could not prove the target.';
  return `This ${step.step_type.replaceAll('_', ' ')} step is backed by ${step.source_span.file_path}:${step.source_span.start_line}-${step.source_span.end_line}.`;
}

function flowProofSelection(flowDetail: FlowDetailDTO): CodeCompanionSelection {
  return {
    subject_type: 'flow',
    subject_id: flowDetail.flow.id,
    title: flowDetail.flow.name,
    open: true,
  };
}

function linkedSummary(linked: FlowStepDTO['linked_frontend_event'] | FlowStepDTO['linked_api_call'] | FlowStepDTO['linked_route']) {
  if (!linked) return '';
  if ('event_label' in linked) return linked.event_label || linked.event_type;
  if ('url_template' in linked) return `${linked.method} ${linked.url_template}`;
  return `${linked.method} ${linked.path_template}`;
}

function copyCurrentUrl() {
  if (typeof window === 'undefined') return;
  void navigator.clipboard?.writeText(window.location.href);
}
