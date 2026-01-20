
export interface ExplanationResult {
  explanation: string;
  summary: string[];
  simplifiedTerms: { original: string; simplified: string }[];
}

export interface UserUsage {
  count: number;
  lastDate: string;
}

export interface UserProfile {
  isPremium: boolean;
  usage: UserUsage;
}
