import { create } from 'zustand';

export interface TokenUsage {
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  estimatedCostUSD: number;
}

interface TokenState {
  sessionUsage: TokenUsage;
  recordApiCall: (tokensIn: number, tokensOut: number, model?: string) => void;
  resetSession: () => void;
}

// Pricing index per 1M tokens (values from common providers like OpenRouter/DeepSeek/OpenAI)
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  'deepseek/deepseek-v4-flash': { in: 0.00000007, out: 0.00000027 }, // $0.07 / $0.27 per M
  'deepseek/deepseek-chat': { in: 0.00000014, out: 0.00000028 },     // $0.14 / $0.28 per M
  'openai/gpt-4o-mini': { in: 0.00000015, out: 0.0000006 },
  'default': { in: 0.00000015, out: 0.0000006 } // Default fallback mini-pricing
};

export const useTokenStore = create<TokenState>((set) => ({
  sessionUsage: {
    tokensIn: 0,
    tokensOut: 0,
    totalTokens: 0,
    estimatedCostUSD: 0
  },

  recordApiCall: (tokensIn, tokensOut, model = 'default') => set((state) => {
    // Normalise model key
    const modelKey = model.toLowerCase();
    const pricing = MODEL_PRICING[modelKey] || MODEL_PRICING['default'];
    
    const callCost = (tokensIn * pricing.in) + (tokensOut * pricing.out);
    const newIn = state.sessionUsage.tokensIn + tokensIn;
    const newOut = state.sessionUsage.tokensOut + tokensOut;

    return {
      sessionUsage: {
        tokensIn: newIn,
        tokensOut: newOut,
        totalTokens: newIn + newOut,
        estimatedCostUSD: state.sessionUsage.estimatedCostUSD + callCost
      }
    };
  }),

  resetSession: () => set({
    sessionUsage: {
      tokensIn: 0,
      tokensOut: 0,
      totalTokens: 0,
      estimatedCostUSD: 0
    }
  })
}));
