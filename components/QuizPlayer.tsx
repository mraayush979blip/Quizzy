
import React, { useState, useEffect } from 'react';
import { QuizQuestion } from '../types';
import { CheckCircle, XCircle, Trophy, ArrowRight, RotateCcw, ListChecks, AlertCircle } from 'lucide-react';
import Button from './Button';
import clsx from 'clsx';

interface QuizPlayerProps {
  data: string; // JSON string of QuizQuestion[]
  onRestart?: () => void;
  onComplete?: (score: number, total: number) => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ data, onRestart, onComplete }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [parseError, setParseError] = useState(false);
  
  // Store user answers: Index -> Selected Option
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});

  // Effect to notify parent of completion only once when summary is shown
  useEffect(() => {
    if (showSummary && onComplete && questions.length > 0) {
      onComplete(score, questions.length);
    }
  }, [showSummary]); // Only depend on showSummary to prevent re-firing

  useEffect(() => {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        setQuestions(parsed);
      } else {
        setParseError(true);
      }
    } catch (e) {
      console.error("Failed to parse quiz data", e);
      setParseError(true);
    }
  }, [data]);

  const handleOptionClick = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
  };

  const handleSubmit = () => {
    if (!selectedOption) return;
    
    setIsAnswered(true);
    setUserAnswers(prev => ({ ...prev, [currentIndex]: selectedOption }));

    if (selectedOption === questions[currentIndex].correctAnswer) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setShowSummary(true);
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setScore(0);
    setShowSummary(false);
    setSelectedOption(null);
    setIsAnswered(false);
    setUserAnswers({});
    if (onRestart) onRestart();
  };

  if (parseError) {
    return (
      <div className="p-6 text-center text-red-500 dark:text-red-400 flex flex-col items-center">
        <AlertCircle className="w-10 h-10 mb-2" />
        <p>Unable to load quiz. The data format was invalid.</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return null; // Loading or empty
  }

  // ==========================================
  // RESULT / SUMMARY VIEW
  // ==========================================
  if (showSummary) {
    const percentage = Math.round((score / questions.length) * 100);
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    
    return (
      <div className="animate-fade-in font-sans">
        {/* Score Header */}
        <div className="text-center mb-10">
          <div className="relative w-48 h-48 mx-auto mb-8">
            <svg className="w-full h-full transform -rotate-90 drop-shadow-2xl" viewBox="0 0 128 128">
               <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#e879f9" />
                  </linearGradient>
               </defs>
               {/* Background Track */}
               <circle 
                  cx="64" cy="64" r={radius} 
                  stroke="currentColor" 
                  strokeWidth="8" 
                  fill="transparent" 
                  className="text-zinc-100 dark:text-white/5" 
               />
               {/* Progress Circle */}
               <circle 
                  cx="64" cy="64" r={radius} 
                  stroke={percentage >= 80 ? "url(#progressGradient)" : percentage >= 50 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (circumference * percentage) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
               />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Trophy className={clsx("w-10 h-10 mb-1 drop-shadow-md", percentage >= 60 ? "text-amber-400 fill-amber-400/20" : "text-zinc-300")} />
                <span className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">{percentage}%</span>
            </div>
          </div>
          
          <h3 className="text-3xl font-display font-bold text-zinc-900 dark:text-white mb-2">
             {percentage === 100 ? "Perfect Score!" : percentage >= 80 ? "Great Job!" : "Keep Practicing!"}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400">You answered {score} out of {questions.length} questions correctly.</p>
        </div>

        {/* Detailed Review List */}
        <div className="space-y-6 mb-10">
            <h4 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 flex items-center border-b border-zinc-200 dark:border-white/10 pb-4 uppercase tracking-wider text-sm">
                <ListChecks className="w-5 h-5 mr-2 text-primary-500" />
                Detailed Review
            </h4>
            
            {questions.map((q, idx) => {
                const userAnswer = userAnswers[idx];
                const isCorrect = userAnswer === q.correctAnswer;

                return (
                    <div key={idx} className="bg-zinc-50/50 dark:bg-white/5 rounded-2xl p-6 border border-zinc-200 dark:border-white/5">
                        <div className="flex items-start mb-4">
                            <span className={clsx(
                                "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-4 mt-0.5 border",
                                isCorrect ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300" : "bg-red-100 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300"
                            )}>
                                {idx + 1}
                            </span>
                            <div className="flex-1">
                                <p className="font-semibold text-zinc-900 dark:text-white mb-3 text-lg">{q.question}</p>
                                
                                <div className="space-y-2 text-sm mb-4">
                                    <div className="flex items-center p-2 rounded-lg bg-white dark:bg-black/20 border border-zinc-100 dark:border-white/5">
                                        <span className="w-24 text-zinc-500 dark:text-zinc-400 font-medium uppercase text-xs tracking-wider">Your Answer</span>
                                        <span className={clsx("font-bold", isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                            {userAnswer}
                                        </span>
                                        {isCorrect ? <CheckCircle className="w-4 h-4 text-green-500 ml-auto" /> : <XCircle className="w-4 h-4 text-red-500 ml-auto" />}
                                    </div>
                                    {!isCorrect && (
                                        <div className="flex items-center p-2 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30">
                                            <span className="w-24 text-zinc-500 dark:text-zinc-400 font-medium uppercase text-xs tracking-wider">Correct</span>
                                            <span className="font-bold text-green-600 dark:text-green-400">
                                                {q.correctAnswer}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="text-sm text-zinc-600 dark:text-zinc-300 bg-zinc-100/50 dark:bg-white/5 p-4 rounded-xl leading-relaxed">
                                    <span className="font-bold text-primary-600 dark:text-primary-400 block mb-1">Explanation</span>
                                    {q.explanation}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>

        <Button onClick={restart} className="mx-auto w-full sm:w-auto px-10 shadow-xl shadow-primary-500/20">
          <RotateCcw className="w-4 h-4 mr-2" />
          Take Quiz Again
        </Button>
      </div>
    );
  }

  // ==========================================
  // ACTIVE QUIZ VIEW
  // ==========================================
  const currentQuestion = questions[currentIndex];
  const isCorrect = selectedOption === currentQuestion.correctAnswer;

  return (
    <div className="animate-fade-in">
      {/* Progress Bar */}
      <div className="w-full bg-zinc-100 dark:bg-white/10 h-2 rounded-full mb-8 overflow-hidden">
        <div 
          className="bg-gradient-to-r from-primary-500 to-fuchsia-500 h-2 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(139,92,246,0.5)]"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        ></div>
      </div>

      {/* Question */}
      <div className="mb-8">
        <div className="text-xs font-bold text-zinc-400 dark:text-zinc-500 mb-3 uppercase tracking-widest">
          Question {currentIndex + 1} of {questions.length}
        </div>
        <h3 className="text-2xl md:text-3xl font-display font-bold text-zinc-900 dark:text-white leading-tight">
          {currentQuestion.question}
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-4 mb-8">
        {currentQuestion.options.map((option, idx) => {
          const isSelected = selectedOption === option;
          const isCorrectAnswer = option === currentQuestion.correctAnswer;
          
          let statusClass = "border-zinc-200 dark:border-white/10 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-zinc-50 dark:hover:bg-white/5";
          
          if (isAnswered) {
            if (isCorrectAnswer) {
              statusClass = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 shadow-lg shadow-green-500/10";
            } else if (isSelected) {
              statusClass = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 shadow-lg shadow-red-500/10";
            } else {
              statusClass = "border-zinc-100 dark:border-white/5 opacity-50 grayscale";
            }
          } else if (isSelected) {
            statusClass = "border-primary-600 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-600 shadow-lg shadow-primary-500/10";
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(option)}
              disabled={isAnswered}
              className={clsx(
                "w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 relative group",
                "text-zinc-700 dark:text-zinc-300 font-medium text-lg",
                statusClass
              )}
            >
              <div className="flex items-center">
                <span className={clsx(
                    "w-8 h-8 rounded-lg flex-shrink-0 mr-4 flex items-center justify-center text-sm font-bold transition-colors duration-200",
                    isSelected ? "bg-primary-600 text-white" : "bg-zinc-100 dark:bg-white/10 text-zinc-500"
                )}>
                  {String.fromCharCode(65 + idx)}
                </span>
                {option}
                {isAnswered && isCorrectAnswer && (
                  <CheckCircle className="w-6 h-6 text-green-500 ml-auto animate-pulse" />
                )}
                {isAnswered && isSelected && !isCorrectAnswer && (
                  <XCircle className="w-6 h-6 text-red-500 ml-auto" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation & Controls */}
      <div className="min-h-[100px]">
        {isAnswered ? (
          <div className="animate-slide-up">
             <div className={clsx(
               "p-6 rounded-2xl mb-6 text-base border backdrop-blur-md",
               isCorrect ? "bg-green-50/80 border-green-200 text-green-900 dark:bg-green-900/30 dark:border-green-900/50 dark:text-green-100" : "bg-red-50/80 border-red-200 text-red-900 dark:bg-red-900/30 dark:border-red-900/50 dark:text-red-100"
             )}>
               <p className="font-bold mb-2 flex items-center uppercase tracking-wide text-xs">
                   {isCorrect ? <CheckCircle className="w-4 h-4 mr-2"/> : <XCircle className="w-4 h-4 mr-2"/>}
                   {isCorrect ? "Correct" : "Incorrect"}
               </p>
               <p className="leading-relaxed">{currentQuestion.explanation}</p>
             </div>
             <Button onClick={handleNext} className="w-full h-14 text-lg rounded-xl shadow-xl shadow-primary-500/20">
               {currentIndex === questions.length - 1 ? 'See Results' : 'Next Question'} 
               <ArrowRight className="w-5 h-5 ml-2" />
             </Button>
          </div>
        ) : (
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedOption} 
            className="w-full h-14 text-lg rounded-xl"
          >
            Submit Answer
          </Button>
        )}
      </div>
    </div>
  );
};

export default QuizPlayer;