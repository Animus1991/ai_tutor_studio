import { useState, useEffect, useMemo } from 'react';
import { Brain, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { useOntologyStore } from '../store/useOntologyStore';
import { useMasteryStore } from '../store/useMasteryStore';

interface Topic {
  id: string;
  topic: string;
  course: string;
  retention: number;
  lastReviewed: number; // timestamp
  interval: number; // days
  color: string;
  bg: string;
  border: string;
}

const mockInitialTopics: Topic[] = [
  { id: 't1', topic: 'Derivatives: Chain Rule', course: 'Calculus II', retention: 40, lastReviewed: Date.now() - 3 * 24 * 60 * 60 * 1000, interval: 2, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800/50' },
  { id: 't2', topic: 'Cognitive Dissonance', course: 'Psychology 101', retention: 65, lastReviewed: Date.now() - 7 * 24 * 60 * 60 * 1000, interval: 5, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/50' },
];

export default function SpacedRepetition() {
  const { nodes } = useOntologyStore();
  const addFlashcardReview = useMasteryStore(state => state.addFlashcardReview);
  
  const [topics, setTopics] = useState<Topic[]>([]);

  // Hydrate from ontology or mock
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      const mapped = nodes.slice(0, 3).map((n, i) => {
        const isUrgent = i === 0;
        return {
          id: n.id,
          topic: n.label,
          course: 'Imported Document',
          retention: isUrgent ? 30 : 70,
          lastReviewed: Date.now() - (isUrgent ? 5 : 1) * 24 * 60 * 60 * 1000,
          interval: isUrgent ? 2 : 5,
          color: isUrgent ? 'text-rose-500' : 'text-amber-500',
          bg: isUrgent ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-amber-50 dark:bg-amber-900/20',
          border: isUrgent ? 'border-rose-200 dark:border-rose-800/50' : 'border-amber-200 dark:border-amber-800/50'
        };
      });
      setTopics(mapped);
    } else {
      setTopics(mockInitialTopics);
    }
  }, [nodes]);

  const isDue = (topic: Topic) => {
    const nextReviewTime = topic.lastReviewed + topic.interval * 24 * 60 * 60 * 1000;
    return Date.now() > nextReviewTime;
  };

  const handleReview = (id: string) => {
    // Add points to global mastery for reviewing a topic
    addFlashcardReview(); 
    addFlashcardReview(); // give extra points for topic review

    setTopics(topics.map(t => {
      if (t.id === id) {
        return {
          ...t,
          retention: Math.min(100, t.retention + 30),
          lastReviewed: Date.now(),
          interval: t.interval * 2.5,
          color: 'text-indigo-500',
          bg: 'bg-indigo-50 dark:bg-indigo-900/20',
          border: 'border-indigo-200 dark:border-indigo-800/50'
        };
      }
      return t;
    }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200/60 dark:border-slate-800/60 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" />
            Smart Review
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Optimized by the forgetting curve.</p>
        </div>
      </div>
      
      <div className="space-y-4 flex-1">
        {topics.map((topic) => {
          const due = isDue(topic);
          return (
            <div key={topic.id} className={`p-4 rounded-2xl border transition-all hover:shadow-md cursor-pointer relative overflow-hidden ${topic.bg} ${topic.border}`}>
              {due && (
                <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                  DUE FOR REVIEW
                </div>
              )}
              <div className="flex justify-between items-start mb-2 mt-2">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base leading-tight mb-1">{topic.topic}</h4>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{topic.course}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className={topic.color}>{topic.retention}% Retained</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  {due && <AlertCircle className="w-3 h-3 text-rose-500" />}
                  {Math.round((Date.now() - topic.lastReviewed) / (1000 * 60 * 60 * 24))} days ago
                </span>
                <button onClick={(e) => { e.stopPropagation(); handleReview(topic.id); }} className={`text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all ${topic.color}`}>
                  Review <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
