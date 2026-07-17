import { Card, FSRS, Rating } from 'fsrs.js';

const fsrs = new FSRS();

export type FSRSRating = 'again' | 'hard' | 'good' | 'easy';

export interface FSRSData {
  stability: number;
  difficulty: number;
  retrievability: number;
  last_review: Date | null;
  next_review: Date | null;
  reps: number;
  card?: Record<string, unknown>;
}

const ratingMap: Record<FSRSRating, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function hydrateCard(data?: FSRSData): Card {
  const card = new Card();
  if (!data?.card) return card;
  Object.assign(card, data.card);
  if (typeof card.due === 'string') card.due = new Date(card.due);
  if (typeof card.last_review === 'string') {
    card.last_review = new Date(card.last_review);
  }
  return card;
}

function serializeCard(card: Card): Record<string, unknown> {
  return {
    ...card,
    due: card.due instanceof Date ? card.due.toISOString() : card.due,
    last_review:
      card.last_review instanceof Date
        ? card.last_review.toISOString()
        : card.last_review,
  };
}

export function cardToFSRSData(card: Card): FSRSData {
  return {
    stability: card.stability ?? 0,
    difficulty: card.difficulty ?? 0,
    retrievability: 1,
    last_review: card.last_review ?? null,
    next_review: card.due ?? new Date(),
    reps: card.reps ?? 0,
    card: serializeCard(card),
  };
}

export function initializeFSRS(): FSRSData {
  return cardToFSRSData(new Card());
}

export function reviewFSRS(data: FSRSData, rating: FSRSRating): FSRSData {
  const now = new Date();
  const scheduling = fsrs.repeat(hydrateCard(data), now);
  return cardToFSRSData(scheduling[ratingMap[rating]].card);
}
