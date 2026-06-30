export type FSRSRating = 'again' | 'hard' | 'good' | 'easy';

export interface FSRSData {
  stability: number;
  difficulty: number;
  retrievability: number;
  last_review: Date | null;
  next_review: Date | null;
  reps: number;
}

export function initializeFSRS(): FSRSData {
  return {
    stability: 2,
    difficulty: 5,
    retrievability: 1,
    last_review: null,
    next_review: new Date(),
    reps: 0
  };
}

export function reviewFSRS(data: FSRSData, rating: FSRSRating): FSRSData {
  const now = new Date();
  
  // Basic FSRS-4 simplified heuristic for updating stability and difficulty
  let newDifficulty = data.difficulty;
  let newStability = data.stability;
  
  switch (rating) {
    case 'again':
      newDifficulty = Math.min(10, data.difficulty + 2);
      newStability = Math.max(0.5, data.stability * 0.5);
      break;
    case 'hard':
      newDifficulty = Math.min(10, data.difficulty + 1);
      newStability = data.stability * 1.5;
      break;
    case 'good':
      newDifficulty = data.difficulty;
      newStability = data.stability * 2.5;
      break;
    case 'easy':
      newDifficulty = Math.max(1, data.difficulty - 1);
      newStability = data.stability * 4;
      break;
  }
  
  // Calculate next review interval in hours based on stability
  // S = interval in days where retention = 90%
  const intervalDays = newStability;
  const nextReview = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  
  return {
    stability: newStability,
    difficulty: newDifficulty,
    retrievability: 1, // Reset retrievability on review
    last_review: now,
    next_review: nextReview,
    reps: data.reps + 1
  };
}
