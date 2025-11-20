
import React, { useState, useEffect } from 'react';
import { Flashcard } from '../types';
import { ChevronLeft, ChevronRight, RotateCcw, Layers, Keyboard } from 'lucide-react';
import Button from './Button';
import clsx from 'clsx';

interface FlashcardPlayerProps {
  data: string; // JSON string of Flashcard[]
}

const FlashcardPlayer: React.FC<FlashcardPlayerProps> = ({ data }) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        setCards(parsed);
        setCurrentIndex(0);
        setIsFlipped(false);
      } else {
        setParseError(true);
      }
    } catch (e) {
      console.error("Failed to parse flashcard data", e);
      setParseError(true);
    }
  }, [data]);

  // Keyboard Navigation Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (cards.length === 0) return;

      switch (e.key) {
        case 'ArrowRight':
          if (currentIndex < cards.length - 1) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
          }
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) {
            setIsFlipped(false);
            setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
          }
          break;
        case ' ':
        case 'Enter':
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault(); // Prevent scrolling
          setIsFlipped(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, cards.length]);

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev - 1), 150);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleRestart = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(0), 150);
  };

  if (parseError) {
    return <div className="text-red-500">Error loading flashcards.</div>;
  }

  if (cards.length === 0) return null;

  const currentCard = cards[currentIndex];

  return (
    <div className="flex flex-col items-center justify-center w-full animate-fade-in py-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-lg mb-6 px-2">
        <div className="flex items-center text-slate-500 dark:text-slate-400">
            <Layers className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Card {currentIndex + 1} of {cards.length}</span>
        </div>
        <button 
            onClick={handleRestart}
            className="text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline flex items-center"
        >
            <RotateCcw className="w-3 h-3 mr-1" /> Reset
        </button>
      </div>

      {/* 3D Card Container */}
      <div 
        className="group perspective-1000 w-full max-w-lg h-80 cursor-pointer"
        onClick={handleFlip}
      >
        <div className={clsx(
          "relative w-full h-full transition-all duration-500 transform-style-3d shadow-xl rounded-2xl",
          isFlipped ? "rotate-y-180" : ""
        )}>
          
          {/* Front Side */}
          <div className="absolute w-full h-full backface-hidden rounded-2xl p-8 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex flex-col items-center justify-center text-center select-none">
            <div className="absolute top-4 left-4 text-xs font-bold tracking-wider text-slate-400 uppercase">
                Front
            </div>
            <div className="prose dark:prose-invert max-w-none">
                <h3 className="text-2xl font-semibold text-slate-800 dark:text-white">
                    {currentCard.front}
                </h3>
            </div>
            <div className="absolute bottom-4 text-xs text-slate-400 animate-pulse">
                Click or Space to flip
            </div>
          </div>

          {/* Back Side */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-2xl p-8 bg-indigo-600 dark:bg-indigo-900 border border-indigo-500 flex flex-col items-center justify-center text-center select-none">
             <div className="absolute top-4 left-4 text-xs font-bold tracking-wider text-indigo-200 uppercase">
                Back
            </div>
            <div className="prose prose-invert max-w-none">
                <p className="text-xl font-medium text-white leading-relaxed">
                    {currentCard.back}
                </p>
            </div>
          </div>

        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center space-x-6 mt-8">
        <Button
          variant="secondary"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="rounded-full w-12 h-12 !p-0 flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <div className="text-sm font-medium text-slate-400 flex items-center gap-1.5">
            <Keyboard className="w-4 h-4" />
            <span>Use arrow keys</span>
        </div>

        <Button
          variant="primary"
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          className="rounded-full w-12 h-12 !p-0 flex items-center justify-center"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

export default FlashcardPlayer;
