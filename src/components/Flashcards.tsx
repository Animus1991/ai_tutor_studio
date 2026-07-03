import { useState, useEffect } from 'react';
import { Layers, Plus, ChevronLeft, ChevronRight, Check, X, RotateCw } from 'lucide-react';
import localforage from 'localforage';
import { toast } from 'sonner';
import { FSRS, Card, Rating, State } from 'fsrs.js';
import { useStore } from '../store/useStore';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  fsrsCard?: any; // Stores serialized FSRS Card
  nextReviewDate?: string;
  type?: string;
  imageUrl?: string;
  box?: number[];
}

interface Deck {
  id: string;
  title: string;
  cards: Flashcard[];
}

const fsrs = new FSRS();

export default function Flashcards() {
  const addXP = useStore(state => state.addXP);
  
  const [decks, setDecks] = useState<Deck[]>([
    {
      id: 'default',
      title: 'Sample Web Dev Deck',
      cards: [
        { id: '1', front: 'What is a closure in JavaScript?', back: 'A closure is the combination of a function bundled together with references to its surrounding state (the lexical environment).' },
        { id: '2', front: 'What does CSS stand for?', back: 'Cascading Style Sheets.' },
      ]
    }
  ]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState<Record<string, number>>({});
  
  // Create mode
  const [isCreating, setIsCreating] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  const activeDeck = decks.find(d => d.id === activeDeckId);
  const currentCard = activeDeck?.cards[currentIndex];

  const handleStartReview = (deckId: string) => {
    setActiveDeckId(deckId);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const logReviewSession = async (deckTitle: string, cardsReviewed: number) => {
    try {
      const logs = await localforage.getItem<any[]>('memora-ai-logs') || [];
      logs.push({
        id: Date.now().toString(),
        title: `Reviewed ${cardsReviewed} flashcards in "${deckTitle}"`,
        time: new Date().toLocaleString(),
        icon: 'BookOpen'
      });
      await localforage.setItem('memora-ai-logs', logs);
    } catch (e) {
      console.error('Failed to log flashcard review', e);
    }
  };

  const handleRate = (ratingType: 'again' | 'hard' | 'good' | 'easy') => {
    if (!activeDeck || !currentCard) return;
    
    // FSRS algorithm
    let cardObj = new Card();
    if (currentCard.fsrsCard) {
      Object.assign(cardObj, currentCard.fsrsCard);
      if (typeof cardObj.due === 'string') cardObj.due = new Date(cardObj.due);
      if (typeof cardObj.last_review === 'string') cardObj.last_review = new Date(cardObj.last_review);
    }

    const now = new Date();
    const scheduling_cards = fsrs.repeat(cardObj, now);
    
    let ratingValue = Rating.Good;
    if (ratingType === 'again') {
      ratingValue = Rating.Again;
      setFailedAttempts(prev => ({ ...prev, [currentCard.id]: (prev[currentCard.id] || 0) + 1 }));
    }
    else if (ratingType === 'hard') ratingValue = Rating.Hard;
    else if (ratingType === 'good') ratingValue = Rating.Good;
    else if (ratingType === 'easy') ratingValue = Rating.Easy;

    if (ratingType !== 'again') {
      setFailedAttempts(prev => ({ ...prev, [currentCard.id]: 0 }));
      addXP(10); // Reward for non-failing rate
    }

    const newCardInfo = scheduling_cards[ratingValue];
    const newFsrsCard = newCardInfo.card;
    const nextReview = newFsrsCard.due;
    
    setDecks(prev => prev.map(deck => {
      if (deck.id === activeDeckId) {
        return {
          ...deck,
          cards: deck.cards.map(c => 
            c.id === currentCard.id ? { 
              ...c, 
              fsrsCard: newFsrsCard, 
              nextReviewDate: nextReview.toISOString() 
            } : c
          )
        };
      }
      return deck;
    }));

    toast.success(`Rated ${ratingType}. Next review: ${nextReview.toLocaleDateString()}`);
    
    if (currentIndex < activeDeck.cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      // Finished deck
      logReviewSession(activeDeck.title, activeDeck.cards.length);
      toast.success('You completed the deck review!');
      setActiveDeckId(null);
    }
  };

  const handleNext = () => {
    if (!activeDeck) return;
    if (currentIndex < activeDeck.cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      // Finished deck
      logReviewSession(activeDeck.title, activeDeck.cards.length);
      toast.success('You completed the deck review!');
      setActiveDeckId(null);
    }
  };

  const handleAddCard = () => {
    if (!newFront.trim() || !newBack.trim() || !activeDeckId) return;
    setDecks(prev => prev.map(deck => {
      if (deck.id === activeDeckId) {
        return {
          ...deck,
          cards: [...deck.cards, { id: Date.now().toString(), front: newFront, back: newBack }]
        };
      }
      return deck;
    }));
    setNewFront('');
    setNewBack('');
    toast.success('Card added to deck!');
    setIsCreating(false);
  };

  if (activeDeck) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
              {activeDeck.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Card {currentIndex + 1} of {activeDeck.cards.length}
            </p>
          </div>
          <button 
            onClick={() => setActiveDeckId(null)}
            className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {currentCard ? (
          <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[200px] cursor-pointer [perspective:1000px]" onClick={() => setIsFlipped(!isFlipped)}>
             <div className={`w-full max-w-sm h-64 relative transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
               {/* Front */}
               <div className="absolute inset-0 [backface-visibility:hidden] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center shadow-sm">
                 {currentCard.type === 'occlusion' && currentCard.imageUrl && currentCard.box ? (
                   <div className="relative mb-4 flex-1 w-full max-h-40 overflow-hidden flex justify-center items-center">
                     <div className="relative inline-block h-full">
                       <img src={currentCard.imageUrl} alt="Occlusion" className="max-h-full max-w-full object-contain rounded" />
                       <div 
                         className="absolute bg-slate-900 border-2 border-slate-900" 
                         style={{
                           top: `${currentCard.box[0]}px`, left: `${currentCard.box[1]}px`,
                           height: `${currentCard.box[2] - currentCard.box[0]}px`, width: `${currentCard.box[3] - currentCard.box[1]}px`
                         }}
                       />
                     </div>
                   </div>
                 ) : null}
                 <p className="text-center font-medium text-lg text-slate-800 dark:text-slate-200">{currentCard.front}</p>
                 <div className="absolute bottom-4 text-xs text-slate-400 flex items-center gap-1"><RotateCw className="w-3 h-3" /> Tap to flip</div>
               </div>
               
               {/* Back */}
               <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6 flex flex-col items-center justify-center shadow-sm overflow-y-auto">
                 {currentCard.type === 'occlusion' && currentCard.imageUrl && currentCard.box ? (
                   <div className="relative mb-4 flex-1 w-full max-h-40 overflow-hidden flex justify-center items-center">
                     <div className="relative inline-block h-full">
                       <img src={currentCard.imageUrl} alt="Occlusion" className="max-h-full max-w-full object-contain rounded opacity-75" />
                       <div 
                         className="absolute border-4 border-indigo-500 bg-indigo-500/20" 
                         style={{
                           top: `${currentCard.box[0]}px`, left: `${currentCard.box[1]}px`,
                           height: `${currentCard.box[2] - currentCard.box[0]}px`, width: `${currentCard.box[3] - currentCard.box[1]}px`
                         }}
                       />
                     </div>
                   </div>
                 ) : null}
                 <p className="text-center font-medium text-lg text-indigo-900 dark:text-indigo-100 mb-6">{currentCard.back}</p>
                 {failedAttempts[currentCard.id] >= 2 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); toast.success('Opening AI Tutor to explain this concept using the Feynman Technique...'); }}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-full shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                    >
                      <RotateCw className="w-4 h-4" /> Need help? Ask AI Tutor
                    </button>
                  )}
               </div>
             </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
             No cards in this deck.
          </div>
        )}

        <div className="flex justify-center mt-6 gap-3">
           {!isFlipped ? (
             <button 
               onClick={() => setIsFlipped(true)}
               className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors w-full max-w-sm"
             >
               Show Answer
             </button>
           ) : (
             <div className="flex w-full max-w-sm gap-2">
               <button 
                 onClick={(e) => { e.stopPropagation(); handleRate('again'); }}
                 className="flex-1 py-2.5 rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
               >
                 Again
               </button>
               <button 
                 onClick={(e) => { e.stopPropagation(); handleRate('hard'); }}
                 className="flex-1 py-2.5 rounded-lg font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 transition-colors"
               >
                 Hard
               </button>
               <button 
                 onClick={(e) => { e.stopPropagation(); handleRate('good'); }}
                 className="flex-1 py-2.5 rounded-lg font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors"
               >
                 Good
               </button>
               <button 
                 onClick={(e) => { e.stopPropagation(); handleRate('easy'); }}
                 className="flex-1 py-2.5 rounded-lg font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors"
               >
                 Easy
               </button>
             </div>
           )}
        </div>

      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
              Study Decks
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Review your flashcards</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {decks.map(deck => (
          <div key={deck.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-200 dark:hover:border-slate-700 transition-colors flex items-center justify-between group">
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white">{deck.title}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{deck.cards.length} cards</p>
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={() => { setActiveDeckId(deck.id); setIsCreating(true); }}
                 className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors opacity-0 group-hover:opacity-100"
               >
                 <Plus className="w-4 h-4" />
               </button>
               <button 
                 onClick={() => handleStartReview(deck.id)}
                 className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition-colors"
               >
                 Review
               </button>
            </div>
          </div>
        ))}

        {isCreating && activeDeckId && (
          <div className="mt-4 p-4 border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl space-y-3">
             <h4 className="text-sm font-medium text-slate-900 dark:text-white">Add Card to {decks.find(d => d.id === activeDeckId)?.title}</h4>
             <input 
               value={newFront}
               onChange={(e) => setNewFront(e.target.value)}
               placeholder="Front side (Question)"
               className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
             />
             <input 
               value={newBack}
               onChange={(e) => setNewBack(e.target.value)}
               placeholder="Back side (Answer)"
               className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
             />
             <div className="flex justify-end gap-2 pt-2">
               <button onClick={() => setIsCreating(false)} className="px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">Cancel</button>
               <button onClick={handleAddCard} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Add</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
