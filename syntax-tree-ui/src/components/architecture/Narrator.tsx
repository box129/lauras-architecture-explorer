import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { useSyntaxTreeStore } from '../../store';
import { useArchOverview, useSubsystems, useViolations } from '../../api/hooks';
import { buildNarratorSteps, type NarratorStep } from '../../utils/narrator';

export default function Narrator() {
  const narratorActive = useSyntaxTreeStore((s) => s.narratorActive);
  const narratorStep = useSyntaxTreeStore((s) => s.narratorStep);
  const stopNarrator = useSyntaxTreeStore((s) => s.stopNarrator);
  const advanceNarrator = useSyntaxTreeStore((s) => s.advanceNarrator);
  const retreatNarrator = useSyntaxTreeStore((s) => s.retreatNarrator);
  const setViewType = useSyntaxTreeStore((s) => s.setViewType);

  const { data: overview } = useArchOverview();
  const { data: subsystemsData } = useSubsystems();
  const { data: violationsData } = useViolations();
  const { fitView, setCenter, getNode } = useReactFlow();

  const steps: NarratorStep[] = useMemo(() => {
    if (!overview) return [];
    return buildNarratorSteps(
      overview,
      subsystemsData?.subsystems || [],
      violationsData?.violations || [],
    );
  }, [overview, subsystemsData, violationsData]);

  const currentStep = steps[narratorStep] || null;

  // Update view type when narrator step changes
  useEffect(() => {
    if (!narratorActive) return;
    if (!currentStep) return;
    setViewType(currentStep.view as 'architecture' | 'layered');
  }, [narratorActive, currentStep, setViewType]);

  // Focus on highlighted node
  useEffect(() => {
    if (!narratorActive) return;
    if (!currentStep?.highlightQN) {
      fitView({ duration: 400 });
      return;
    }
    const node = getNode(currentStep.highlightQN);
    if (node) {
      setCenter(node.position.x + 100, node.position.y + 40, { zoom: 1.2, duration: 400 });
    }
  }, [narratorActive, currentStep, fitView, setCenter, getNode]);

  if (!narratorActive) return null;

  // Participant 1 formative finding: "how does this play guide thing
  // works, it doesn't seem to work" -- traced to exactly this: clicking
  // "Take the Tour" always set narratorActive, but this component silently
  // rendered nothing whenever `steps` came back empty (which it reliably
  // does for any analysis produced by the current Observatory pipeline --
  // these steps are built from a separate, legacy overview/subsystems/
  // violations API this tour has always depended on). A dead click with no
  // feedback at all is exactly what was reported as "broken." An honest,
  // dismissible message is the smallest fix that doesn't require rebuilding
  // this tour on top of the current architecture-map data.
  if (steps.length === 0) {
    return (
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto max-w-[420px] w-full">
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-5">
            <p className="text-sm text-primary leading-relaxed">
              The tour needs an older analysis summary that this run doesn&rsquo;t have, so there&rsquo;s
              nothing to walk through right now.
            </p>
            <div className="flex justify-end mt-4">
              <button
                onClick={stopNarrator}
                className="px-3 py-1.5 text-xs text-white bg-accent rounded hover:bg-accent/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isLast = narratorStep >= steps.length - 1;

  return (
    <AnimatePresence>
      <div className="absolute inset-0 pointer-events-none z-20">
        {/* Spotlight overlay */}
        {currentStep?.highlightQN && (
          <div className="absolute inset-0 bg-black/40" />
        )}

        {/* Narration card */}
        <motion.div
          key={narratorStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto max-w-[520px] w-full"
        >
          <div className="bg-surface border border-border rounded-xl shadow-2xl p-5">
            <p className="text-sm text-primary leading-relaxed">{currentStep?.narration}</p>

            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px] text-secondary">
                Step {narratorStep + 1} of {steps.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={retreatNarrator}
                  disabled={narratorStep === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-secondary hover:text-primary disabled:opacity-30 bg-bg border border-border rounded"
                >
                  <ChevronLeft size={12} /> Back
                </button>
                {isLast ? (
                  <button
                    onClick={stopNarrator}
                    className="px-3 py-1.5 text-xs text-white bg-accent rounded hover:bg-accent/90"
                  >
                    Finish Tour
                  </button>
                ) : (
                  <button
                    onClick={advanceNarrator}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-accent rounded hover:bg-accent/90"
                  >
                    Next <ChevronRight size={12} />
                  </button>
                )}
                <button
                  onClick={stopNarrator}
                  className="text-secondary hover:text-primary ml-1"
                  title="Skip tour"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
