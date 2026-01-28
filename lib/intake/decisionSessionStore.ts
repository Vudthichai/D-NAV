import type { DecisionCandidate } from "@/lib/intake/decisionExtractLocal";

export type ExtractedDecisionCandidate = DecisionCandidate;

export interface DecisionSessionState {
  extractedCandidates: ExtractedDecisionCandidate[];
}

export type DecisionSessionActionPayloadMap = {
  setExtractedCandidates: {
    candidates: ExtractedDecisionCandidate[];
  };
  updateExtractedCandidate: {
    sessionDecisionId: string;
    updatedCandidate: ExtractedDecisionCandidate;
  };
  dismissExtractedCandidate: {
    sessionDecisionId: string;
  };
};

export type DecisionSessionAction = {
  [K in keyof DecisionSessionActionPayloadMap]: {
    type: K;
    payload: DecisionSessionActionPayloadMap[K];
  };
}[keyof DecisionSessionActionPayloadMap];

export const decisionSessionReducer = (
  state: DecisionSessionState,
  action: DecisionSessionAction,
): DecisionSessionState => {
  switch (action.type) {
    case "setExtractedCandidates":
      return {
        ...state,
        extractedCandidates: action.payload.candidates,
      };
    case "updateExtractedCandidate": {
      const { sessionDecisionId, updatedCandidate } = action.payload;
      return {
        ...state,
        extractedCandidates: state.extractedCandidates.map((candidate) =>
          candidate.id === sessionDecisionId ? updatedCandidate : candidate,
        ),
      };
    }
    case "dismissExtractedCandidate":
      return {
        ...state,
        extractedCandidates: state.extractedCandidates.filter(
          (candidate) => candidate.id !== action.payload.sessionDecisionId,
        ),
      };
    default:
      return state;
  }
};
