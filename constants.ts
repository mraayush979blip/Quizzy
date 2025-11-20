import { StudyGoal } from './types';

export const PROMPT_TEMPLATES: Record<StudyGoal, string> = {
  [StudyGoal.QUIZ]: "Create 5 challenging multiple-choice questions about this topic to test understanding.",
  [StudyGoal.EXPLAIN_SIMPLY]: "Explain this topic in simple terms suitable for a beginner. Use analogies if helpful. Format with clear headings and bullet points.",
  [StudyGoal.FLASHCARDS]: "Create 8 high-quality flashcards covering key concepts, definitions, and interesting facts about the topic.",
  [StudyGoal.SUMMARY]: "Provide a concise executive summary of the key concepts. Use bullet points for readability.",
  [StudyGoal.ELABORATE]: "Explain this topic in depth. Include historical context (if applicable), key principles, and at least two real-world examples."
};

export const STORAGE_KEY_HISTORY = 'quizzy_history_v1';
export const STORAGE_KEY_USER = 'quizzy_user_v1';
export const STORAGE_KEY_THEME = 'quizzy_theme_v1';