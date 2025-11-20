
import React, { useState, useEffect } from 'react';
import { QuizQuestion } from '../types';
import { CheckCircle, XCircle, Trophy, ArrowRight, RotateCcw, ListChecks, AlertCircle } from 'lucide-react';
import Button from './Button';
import clsx from 'clsx';

interface QuizPlayerProps {
  data: string; // JSON string of QuizQuestion[]
  onRestart?: () => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ data, onRestart }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [parseError, setParseError] = useState(false);
  
  // Store user answers: Index -> Selected Option
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});

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
    const circumference = 2 * Math.PI * radius; // ~377
    
    return (
      <div className="animate-fade-in font-sans">
        {/* Score Header */}
        <div className="text-center mb-10">
          {/* Centering Wrapper - using w-40/h-40 for good visibility and mx-auto for centering */}
          <div className="relative w-40 h-40 mx-auto mb-6">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
               {/* Background Track */}
               <circle 
                  cx="64" cy="64" r={radius} 
                  stroke="currentColor" 
                  strokeWidth="8" 
                  fill="transparent" 
                  className="text-slate-100 dark:text-slate-700" 
               />
               {/* Progress Circle */}
               <circle 
                  cx="64" cy="64" r={radius} 
                  stroke="currentColor" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - (circumference * percentage) / 100}
                  strokeLinecap="round"
                  className={clsx(
                      "transition-all duration-1000 ease-out",
                      percentage >= 80 ? "text-green-500" : percentage >= 50 ? "text-amber-500" : "text-red-500"
                  )} 
               />
            </svg>
            {/* Text Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Trophy className={clsx("w-8 h-8 mb-1", percentage >= 60 ? "text-amber-500" : "text-slate-300")} />
                <span className="text-3xl font-bold text-slate-900 dark:text-white">{percentage}%</span>
            </div>
          </div>
          
          <h3 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-2">
             {percentage === 100 ? "Perfect Score!" : percentage >= 80 ? "Great Job!" : "Keep Practicing!"}
          </h3>
          <p className="text-slate-500 dark:text-slate-400">You answered {score} out of {questions.length} questions correctly.</p>
        </div>

        {/* Detailed Review List */}
        <div className="space-y-6 mb-10">
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center border-b border-slate-200 dark:border-slate-700 pb-3">
                <ListChecks className="w-5 h-5 mr-2" />
                Detailed Review
            </h4>
            
            {questions.map((q, idx) => {
                const userAnswer = userAnswers[idx];
                const isCorrect = userAnswer === q.correctAnswer;

                return (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-start mb-3">
                            <span className={clsx(
                                "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5",
                                isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            )}>
                                {idx + 1}
                            </span>
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white mb-3">{q.question}</p>
                                
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center">
                                        <span className="w-24 text-slate-500 dark:text-slate-400 font-medium">Your Answer:</span>
                                        <span className={clsx("font-medium", isCorrect ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                            {userAnswer}
                                        </span>
                                        {isCorrect ? <CheckCircle className="w-4 h-4 text-green-500 ml-2" /> : <XCircle className="w-4 h-4 text-red-500 ml-2" />}
                                    </div>
                                    {!isCorrect && (
                                        <div className="flex items-center">
                                            <span className="w-24 text-slate-500 dark:text-slate-400 font-medium">Correct:</span>
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                                {q.correctAnswer}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                    <span className="font-bold text-slate-700 dark:text-slate-200">Explanation: </span>
                                    {q.explanation}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>

        <Button onClick={restart} className="mx-auto w-full sm:w-auto px-8">
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
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mb-6">
        <div 
          className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
        ></div>
      </div>

      {/* Question */}
      <div className="mb-6">
        <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">
          Question {currentIndex + 1} of {questions.length}
        </div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white leading-snug">
          {currentQuestion.question}
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, idx) => {
          const isSelected = selectedOption === option;
          const isCorrectAnswer = option === currentQuestion.correctAnswer;
          
          let statusClass = "border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800";
          
          if (isAnswered) {
            if (isCorrectAnswer) {
              statusClass = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200";
            } else if (isSelected) {
              statusClass = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200";
            } else {
              statusClass = "border-slate-100 dark:border-slate-800 opacity-50";
            }
          } else if (isSelected) {
            statusClass = "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-600";
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(option)}
              disabled={isAnswered}
              className={clsx(
                "w-full text-left p-4 rounded-lg border transition-all duration-200 relative",
                "text-slate-700 dark:text-slate-300 font-medium",
                statusClass
              )}
            >
              <div className="flex items-center">
                <span className="w-6 h-6 rounded-full border flex-shrink-0 mr-3 flex items-center justify-center text-xs font-bold">
                  {String.fromCharCode(65 + idx)}
                </span>
                {option}
                {isAnswered && isCorrectAnswer && (
                  <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                )}
                {isAnswered && isSelected && !isCorrectAnswer && (
                  <XCircle className="w-5 h-5 text-red-500 ml-auto" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation & Controls */}
      <div className="min-h-[80px]">
        {isAnswered ? (
          <div className="animate-slide-up">
             <div className={clsx(
               "p-4 rounded-lg mb-4 text-sm",
               isCorrect ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
             )}>
               <p className="font-bold mb-1">{isCorrect ? "Correct!" : "Incorrect"}</p>
               <p>{currentQuestion.explanation}</p>
             </div>
             <Button onClick={handleNext} className="w-full">
               {currentIndex === questions.length - 1 ? 'See Results' : 'Next Question'} 
               <ArrowRight className="w-4 h-4 ml-2" />
             </Button>
          </div>
        ) : (
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedOption} 
            className="w-full"
          >
            Submit Answer
          </Button>
        )}
      </div>
    </div>
  );
};

export default QuizPlayer;
