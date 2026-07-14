/**
 * Onboarding content — bilingual strings and structured data for the wizard.
 */

import type { OnboardingRoleId, OnboardingGoalId } from './onboardingProfile';
import type { Language } from './i18n';

export interface RoleOption {
  id: OnboardingRoleId;
  label: string;
  description: string;
}

export interface GoalOption {
  id: OnboardingGoalId;
  label: string;
  description: string;
}

export interface FeatureCard {
  title: string;
  desc: string;
}

export interface OnboardingContent {
  welcomeTitle: string;
  welcomeBody: string;
  welcomeFeatureTitle: string;
  features: FeatureCard[];
  nameLabel: string;
  nameOptional: string;
  namePlaceholder: string;
  roleTitle: string;
  roleSubtitle: string;
  roles: RoleOption[];
  goalsTitle: string;
  goalsSubtitle: string;
  goals: GoalOption[];
  scheduleTitle: string;
  scheduleSubtitle: string;
  dailyGoalLabel: string;
  dailyGoalUnit: string;
  examDateLabel: string;
  examDateHint: string;
  continueButton: string;
  backButton: string;
  finishButton: string;
  skipButton: string;
  resumeDraftHint: string;
  progressAria: string;
  validationRoleRequired: string;
  validationGoalRequired: string;
  validationExamDateRequired: string;
  validationExamDatePast: string;
}

const EN: OnboardingContent = {
  welcomeTitle: 'Welcome to Memora',
  welcomeBody: 'Your AI-powered study workspace. Upload material, and we\'ll generate interactive lessons, quizzes, flashcards, and concept maps — all grounded in your sources.',
  welcomeFeatureTitle: 'What you can do',
  features: [
    { title: 'Upload & Analyze', desc: 'PDFs, slides, text — auto-extracted into structured lessons' },
    { title: 'Adaptive Quizzes', desc: 'IRT-scored questions that adapt to your level' },
    { title: 'Concept Maps', desc: 'Visual knowledge graphs with force-directed layout' },
    { title: 'Spaced Repetition', desc: 'FSRS flashcards with optimal review scheduling' },
  ],
  nameLabel: 'Display name',
  nameOptional: '(optional)',
  namePlaceholder: 'e.g. Alex',
  roleTitle: 'What best describes you?',
  roleSubtitle: 'This helps us personalize your learning experience.',
  roles: [
    { id: 'university', label: 'University Student', description: 'Lectures, textbooks, academic papers' },
    { id: 'highschool', label: 'High School Student', description: 'Courses, homework, exam prep' },
    { id: 'selflearner', label: 'Self-Learner', description: 'Curiosity-driven, own pace' },
    { id: 'tutor', label: 'Teacher / Tutor', description: 'Preparing materials for students' },
    { id: 'professional', label: 'Professional', description: 'Upskilling, certifications, on-the-job' },
  ],
  goalsTitle: 'What are your goals?',
  goalsSubtitle: 'Select all that apply — you can change these later.',
  goals: [
    { id: 'exam', label: 'Exam Preparation', description: 'Study for a specific upcoming exam' },
    { id: 'mastery', label: 'Deep Mastery', description: 'Fully understand a subject area' },
    { id: 'review', label: 'Quick Review', description: 'Refresh existing knowledge' },
    { id: 'exploration', label: 'Exploration', description: 'Learn something new for fun' },
    { id: 'teaching', label: 'Teaching Prep', description: 'Prepare explanations and materials' },
  ],
  scheduleTitle: 'Set your study rhythm',
  scheduleSubtitle: 'We\'ll build a personalized schedule based on your availability.',
  dailyGoalLabel: 'Daily study goal',
  dailyGoalUnit: 'minutes',
  examDateLabel: 'Exam date',
  examDateHint: 'We\'ll create a countdown study plan for you.',
  continueButton: 'Continue',
  backButton: 'Back',
  finishButton: 'Start Learning',
  skipButton: 'Skip for now',
  resumeDraftHint: 'We saved your progress — continuing where you left off.',
  progressAria: 'Step {current} of {total}',
  validationRoleRequired: 'Please select your role to continue.',
  validationGoalRequired: 'Please select at least one goal.',
  validationExamDateRequired: 'Please enter your exam date to continue.',
  validationExamDatePast: 'The exam date must be in the future.',
};

const EL: OnboardingContent = {
  welcomeTitle: 'Καλωσήρθες στο Memora',
  welcomeBody: 'Ο χώρος μελέτης σου με AI. Ανέβασε υλικό και θα δημιουργήσουμε μαθήματα, κουίζ, κάρτες και εννοιολογικούς χάρτες — όλα βασισμένα στις πηγές σου.',
  welcomeFeatureTitle: 'Τι μπορείς να κάνεις',
  features: [
    { title: 'Ανέβασμα & Ανάλυση', desc: 'PDF, παρουσιάσεις, κείμενο — αυτόματη εξαγωγή σε δομημένα μαθήματα' },
    { title: 'Προσαρμοστικά Κουίζ', desc: 'Ερωτήσεις με βαθμολόγηση IRT που προσαρμόζονται στο επίπεδό σου' },
    { title: 'Εννοιολογικοί Χάρτες', desc: 'Οπτικοί γράφοι γνώσης με δυναμική διάταξη' },
    { title: 'Επανάληψη με Κενά', desc: 'Κάρτες FSRS με βέλτιστο χρονοδιάγραμμα ανασκόπησης' },
  ],
  nameLabel: 'Όνομα εμφάνισης',
  nameOptional: '(προαιρετικό)',
  namePlaceholder: 'π.χ. Αλέξανδρος',
  roleTitle: 'Ποιο σε περιγράφει καλύτερα;',
  roleSubtitle: 'Βοηθά στην εξατομίκευση της εμπειρίας μάθησης.',
  roles: [
    { id: 'university', label: 'Φοιτητής/τρια', description: 'Διαλέξεις, βιβλία, ακαδημαϊκά papers' },
    { id: 'highschool', label: 'Μαθητής/τρια Λυκείου', description: 'Μαθήματα, εργασίες, εξετάσεις' },
    { id: 'selflearner', label: 'Αυτοδίδακτος', description: 'Μάθηση με δικό σου ρυθμό' },
    { id: 'tutor', label: 'Εκπαιδευτικός', description: 'Προετοιμασία υλικού για μαθητές' },
    { id: 'professional', label: 'Επαγγελματίας', description: 'Αναβάθμιση δεξιοτήτων, πιστοποιήσεις' },
  ],
  goalsTitle: 'Ποιοι είναι οι στόχοι σου;',
  goalsSubtitle: 'Επίλεξε όσα ισχύουν — μπορείς να αλλάξεις αργότερα.',
  goals: [
    { id: 'exam', label: 'Προετοιμασία Εξετάσεων', description: 'Μελέτη για συγκεκριμένη εξέταση' },
    { id: 'mastery', label: 'Βαθιά Κατάκτηση', description: 'Πλήρης κατανόηση ενός θέματος' },
    { id: 'review', label: 'Γρήγορη Ανασκόπηση', description: 'Ανανέωση υπαρχουσών γνώσεων' },
    { id: 'exploration', label: 'Εξερεύνηση', description: 'Μάθε κάτι νέο για χαρά' },
    { id: 'teaching', label: 'Προετοιμασία Διδασκαλίας', description: 'Ετοίμασε επεξηγήσεις και υλικό' },
  ],
  scheduleTitle: 'Ρύθμισε τον ρυθμό μελέτης',
  scheduleSubtitle: 'Θα φτιάξουμε εξατομικευμένο πρόγραμμα με βάση τη διαθεσιμότητά σου.',
  dailyGoalLabel: 'Ημερήσιος στόχος',
  dailyGoalUnit: 'λεπτά',
  examDateLabel: 'Ημερομηνία εξέτασης',
  examDateHint: 'Θα δημιουργήσουμε αντίστροφη μέτρηση μελέτης.',
  continueButton: 'Συνέχεια',
  backButton: 'Πίσω',
  finishButton: 'Ξεκίνα τη Μάθηση',
  skipButton: 'Παράλειψη προς το παρόν',
  resumeDraftHint: 'Αποθηκεύσαμε την πρόοδό σου — συνεχίζεις απ\' όπου σταμάτησες.',
  progressAria: 'Βήμα {current} από {total}',
  validationRoleRequired: 'Επίλεξε τον ρόλο σου για να συνεχίσεις.',
  validationGoalRequired: 'Επίλεξε τουλάχιστον έναν στόχο.',
  validationExamDateRequired: 'Εισάγαγε την ημερομηνία εξέτασης.',
  validationExamDatePast: 'Η ημερομηνία εξέτασης πρέπει να είναι στο μέλλον.',
};

export function getOnboardingContent(lang: Language): OnboardingContent {
  return lang === 'el' ? EL : EN;
}
