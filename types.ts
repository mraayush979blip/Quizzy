export enum StudyGoal {
  QUIZ = 'Take a Quiz',
  EXPLAIN_SIMPLY = 'Explain Simply',
  FLASHCARDS = 'Generate Flashcards',
  SUMMARY = 'Summarize',
  ELABORATE = 'Deep Dive'
}

export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export interface StudyConfig {
  difficulty: Difficulty;
  questionCount: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string; // The string value of the correct option
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizAttempt {
  timestamp: number;
  score: number;
  totalQuestions: number;
}

export interface StudySession {
  id: string;
  topic: string;
  goal: StudyGoal;
  result: string; // JSON string for quizzes/flashcards, plain text for others
  timestamp: number;
  config?: StudyConfig; // Optional config used to generate
  attempts?: QuizAttempt[]; // History of scores for this specific generated content
}

export interface User {
  uid: string;
  email: string | null;
  isAuthenticated: boolean;
}

export type ViewState = 'AUTH' | 'GENERATOR' | 'HISTORY' | 'PROGRESS';

export type Theme = 'light' | 'dark';

export interface FileData {
  mimeType: string;
  data: string; // base64
  name: string;
}