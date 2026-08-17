import EvidenceItemRow from './EvidenceItemRow';
import type { EvidenceChainDTO } from './apiTypes';

interface EvidenceChainViewProps {
  chain: EvidenceChainDTO;
}

export default function EvidenceChainView({ chain }: EvidenceChainViewProps) {
  return (
    <div className="la-evidence-chain">
      <h4>Evidence relationship · {chain.hop_count} hop{chain.hop_count === 1 ? '' : 's'}</h4>
      {chain.reasoning && <p className="la-evidence-chain__reasoning">{chain.reasoning}</p>}
      {chain.items.length > 0 ? (
        <ul className="obs-evidence-list">
          {chain.items.map((item) => (
            <EvidenceItemRow item={item} key={item.id} />
          ))}
        </ul>
      ) : (
        <p className="obs-related__empty">No evidence items were returned for this claim.</p>
      )}
    </div>
  );
}
