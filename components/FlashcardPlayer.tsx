
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
    <div className="flex flex-col items-center justify-center w-full animate-fade-in py-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-xl mb-8 px-4">
        <div className="flex items-center text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-white/10 px-3 py-1.5 rounded-full text-sm font-medium">
            <Layers className="w-4 h-4 mr-2" />
            <span>Card {currentIndex + 1} / {cards.length}</span>
        </div>
        <button 
            onClick={handleRestart}
            className="text-primary-600 dark:text-primary-400 text-sm font-bold hover:underline flex items-center hover:text-primary-500"
        >
            <RotateCcw className="w-3 h-3 mr-1" /> Reset
        </button>
      </div>

      {/* 3D Card Container */}
      <div 
        className="group perspective-1000 w-full max-w-xl h-96 cursor-pointer"
        onClick={handleFlip}
      >
        <div className={clsx(
          "relative w-full h-full transition-all duration-700 transform-style-3d shadow-2xl rounded-3xl",
          isFlipped ? "rotate-y-180" : ""
        )}>
          
          {/* Front Side */}
          <div className="absolute w-full h-full backface-hidden rounded-3xl p-10 bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-white/10 flex flex-col items-center justify-center text-center select-none shadow-inner">
            <div className="absolute top-6 left-6 text-xs font-bold tracking-widest text-zinc-400 uppercase">
                Front
            </div>
            <div className="prose dark:prose-invert max-w-none">
                <h3 className="text-3xl font-display font-bold text-zinc-800 dark:text-white leading-tight">
                    {currentCard.front}
                </h3>
            </div>
            <div className="absolute bottom-6 text-xs font-bold text-primary-500 uppercase tracking-widest animate-pulse">
                Click space to flip
            </div>
          </div>

          {/* Back Side */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 rounded-3xl p-10 bg-gradient-to-br from-primary-600 to-fuchsia-700 border border-white/20 flex flex-col items-center justify-center text-center select-none shadow-2xl shadow-primary-900/50">
             <div className="absolute top-6 left-6 text-xs font-bold tracking-widest text-primary-200 uppercase">
                Back
            </div>
            <div className="prose prose-invert max-w-none overflow-y-auto custom-scrollbar max-h-full">
                <p className="text-xl md:text-2xl font-medium text-white leading-relaxed">
                    {currentCard.back}
                </p>
            </div>
          </div>

        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center space-x-8 mt-10">
        <Button
          variant="secondary"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="rounded-full w-14 h-14 !p-0 flex items-center justify-center shadow-lg"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 bg-zinc-100 dark:bg-white/5 px-4 py-2 rounded-lg">
            <Keyboard className="w-4 h-4" />
            <span>Arrows</span>
        </div>

        <Button
          variant="primary"
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          className="rounded-full w-14 h-14 !p-0 flex items-center justify-center shadow-lg shadow-primary-500/30"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

export default FlashcardPlayer;
