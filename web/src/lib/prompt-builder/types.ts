export type PromptBlockKey =
  | "subject_identity"
  | "fandom_canon"
  | "scene"
  | "cinematic_craft"
  | "emotion_performance"
  | "integration"
  | "negative_constraints"
  | "output_intent";

export interface PromptBlockInput {
  blockKey: PromptBlockKey;
  label?: string | null;
  content: string;
  enabled: boolean;
  strength: number;
  sortOrder: number;
}

export interface AssembledPromptResult {
  text: string;
  parts: Array<{ key: string; weight: number; text: string }>;
}
