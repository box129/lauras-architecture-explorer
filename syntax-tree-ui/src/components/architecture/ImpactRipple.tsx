import { AnimatePresence, motion } from 'framer-motion';
import { useReactFlow } from '@xyflow/react';
import { useSyntaxTreeStore } from '../../store';

export default function ImpactRipple() {
  const ripple = useSyntaxTreeStore((s) => s.impactRipple);
  const clear = useSyntaxTreeStore((s) => s.clearImpactRipple);
  const { getNode } = useReactFlow();

  if (!ripple) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <AnimatePresence>
        {ripple.nodes.map((node) => {
          const rfNode = getNode(node.qn);
          if (!rfNode) return null;

          const intensity = Math.max(0.12, 1 - node.depth * 0.25);
          const ringColor = `rgba(233, 69, 96, ${intensity})`;
          const blurRadius = Math.max(2, 12 - node.depth * 3);

          return (
            <motion.div
              key={node.qn}
              className="absolute rounded-lg border-2 pointer-events-auto cursor-pointer"
              style={{
                left: rfNode.position.x - 4,
                top: rfNode.position.y - 4,
                width: (rfNode.measured?.width || 200) + 8,
                height: (rfNode.measured?.height || 80) + 8,
                borderColor: ringColor,
                boxShadow: `0 0 ${blurRadius}px ${ringColor}`,
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: node.depth * 0.3, duration: 0.5, ease: 'easeOut' }}
              title={`${node.depth} hops from source`}
            />
          );
        })}
      </AnimatePresence>
      <button
        className="absolute top-3 right-3 text-xs text-secondary hover:text-primary pointer-events-auto px-2 py-1 bg-surface border border-border rounded"
        onClick={clear}
      >
        Clear Ripple
      </button>
    </div>
  );
}
