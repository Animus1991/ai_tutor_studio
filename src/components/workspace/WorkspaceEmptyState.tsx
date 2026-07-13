import { Upload, BookOpen, Brain, Calculator, GitCompare, MessageSquare, PenTool, Timer, FlaskConical, GraduationCap, FileText, Network, LayoutDashboard, HelpCircle } from 'lucide-react';
import type { WorkspaceToolId } from '../../lib/workspaceNoteContent';
import { useLanguage } from '../../lib/i18n';

interface WorkspaceEmptyStateProps {
  toolId: WorkspaceToolId;
  hasSource: boolean;
  onUpload?: () => void;
}

interface EmptyConfig {
  icon: typeof Upload;
  title: string;
  titleEl: string;
  description: string;
  descriptionEl: string;
  hint: string;
  hintEl: string;
}

const EMPTY_CONFIGS: Record<WorkspaceToolId, EmptyConfig> = {
  'concept-map': {
    icon: Network,
    title: 'No Concepts Yet',
    titleEl: 'Δεν υπάρχουν έννοιες ακόμα',
    description: 'Upload study material to auto-generate a concept map showing relationships between topics.',
    descriptionEl: 'Ανέβασε υλικό μελέτης για αυτόματη δημιουργία εννοιολογικού χάρτη.',
    hint: 'Supports PDF, text, slides, and transcripts',
    hintEl: 'Υποστηρίζει PDF, κείμενο, παρουσιάσεις και μεταγραφές',
  },
  sandbox: {
    icon: FlaskConical,
    title: 'No Simulation Data',
    titleEl: 'Δεν υπάρχουν δεδομένα προσομοίωσης',
    description: 'Upload economics or quantitative material to enable interactive parameter exploration.',
    descriptionEl: 'Ανέβασε οικονομικό ή ποσοτικό υλικό για διαδραστική εξερεύνηση παραμέτρων.',
    hint: 'Works best with numeric/formula-rich content',
    hintEl: 'Λειτουργεί καλύτερα με περιεχόμενο πλούσιο σε αριθμούς/τύπους',
  },
  leitner: {
    icon: GraduationCap,
    title: 'No Flashcards',
    titleEl: 'Δεν υπάρχουν κάρτες',
    description: 'Upload material with definitions, terms, or glossary to auto-generate spaced repetition flashcards.',
    descriptionEl: 'Ανέβασε υλικό με ορισμούς ή γλωσσάρι για αυτόματη δημιουργία καρτών επανάληψης.',
    hint: 'FSRS algorithm optimizes review intervals',
    hintEl: 'Ο αλγόριθμος FSRS βελτιστοποιεί τα διαστήματα επανάληψης',
  },
  compare: {
    icon: GitCompare,
    title: 'No Comparisons',
    titleEl: 'Δεν υπάρχουν συγκρίσεις',
    description: 'Upload material with contrasting concepts to enable side-by-side comparisons.',
    descriptionEl: 'Ανέβασε υλικό με αντιθετικές έννοιες για σύγκριση δίπλα-δίπλα.',
    hint: 'Look for "vs", "compared to", "unlike" patterns',
    hintEl: 'Αναζήτησε μοτίβα σύγκρισης στο κείμενο',
  },
  whiteboard: {
    icon: PenTool,
    title: 'Empty Canvas',
    titleEl: 'Κενός Καμβάς',
    description: 'Draw diagrams, annotate concepts, and use the formula sidebar for calculations.',
    descriptionEl: 'Σχεδίασε διαγράμματα, σημείωσε έννοιες και χρησιμοποίησε τύπους.',
    hint: 'Whiteboard works even without uploaded material',
    hintEl: 'Ο πίνακας λειτουργεί και χωρίς ανεβασμένο υλικό',
  },
  feynman: {
    icon: Brain,
    title: 'No Topics to Explain',
    titleEl: 'Δεν υπάρχουν θέματα για εξήγηση',
    description: 'Upload material then try explaining concepts in your own words — AI detects gaps.',
    descriptionEl: 'Ανέβασε υλικό και δοκίμασε να εξηγήσεις — η AI εντοπίζει κενά.',
    hint: 'The Feynman technique reveals understanding gaps',
    hintEl: 'Η τεχνική Feynman αποκαλύπτει κενά κατανόησης',
  },
  timer: {
    icon: Timer,
    title: 'Study Timer',
    titleEl: 'Χρονόμετρο Μελέτης',
    description: 'Pomodoro timer with session tracking. Works independently of source material.',
    descriptionEl: 'Χρονόμετρο Pomodoro με καταγραφή. Λειτουργεί ανεξάρτητα.',
    hint: '25/5 Pomodoro cycle, logged to your activity stream',
    hintEl: 'Κύκλος 25/5 Pomodoro, καταγράφεται στη δραστηριότητά σου',
  },
  debate: {
    icon: MessageSquare,
    title: 'No Arguments Found',
    titleEl: 'Δεν βρέθηκαν επιχειρήματα',
    description: 'Upload argumentative material to build debate trees with claims, support, and counterarguments.',
    descriptionEl: 'Ανέβασε επιχειρηματολογικό υλικό για δέντρα debate.',
    hint: 'Works with academic papers, essays, and opinion pieces',
    hintEl: 'Λειτουργεί με ακαδημαϊκά papers, δοκίμια και γνωμοδοτήσεις',
  },
  reader: {
    icon: BookOpen,
    title: 'No Source Material',
    titleEl: 'Δεν υπάρχει πηγαίο υλικό',
    description: 'Upload PDFs, text, or transcripts to enable structured reading with section navigation.',
    descriptionEl: 'Ανέβασε PDF ή κείμενο για δομημένη ανάγνωση με πλοήγηση ενοτήτων.',
    hint: 'Sections, math blocks, and tables are auto-detected',
    hintEl: 'Ενότητες, μαθηματικά blocks και πίνακες εντοπίζονται αυτόματα',
  },
  scratchpad: {
    icon: Calculator,
    title: 'No Formulas Found',
    titleEl: 'Δεν βρέθηκαν τύποι',
    description: 'Upload material with mathematical formulas to enable the formula scratchpad.',
    descriptionEl: 'Ανέβασε υλικό με μαθηματικούς τύπους για το scratchpad.',
    hint: 'Supports LaTeX, inline math, and numeric expressions',
    hintEl: 'Υποστηρίζει LaTeX, inline μαθηματικά και αριθμητικές εκφράσεις',
  },
  source: {
    icon: FileText,
    title: 'No Sources Indexed',
    titleEl: 'Δεν υπάρχουν ευρετηριασμένες πηγές',
    description: 'Upload material to see source intelligence, quality scoring, and annotation tools.',
    descriptionEl: 'Ανέβασε υλικό για αξιολόγηση ποιότητας πηγής και εργαλεία σημειώσεων.',
    hint: 'Source intelligence guides tool recommendations',
    hintEl: 'Η αξιολόγηση πηγής καθοδηγεί τα εργαλεία',
  },
  dashboard: {
    icon: LayoutDashboard,
    title: 'No Progress Data Yet',
    titleEl: 'Δεν υπάρχουν δεδομένα προόδου ακόμα',
    description: 'Study with other tools to populate mastery, quiz accuracy, and engagement tracking here.',
    descriptionEl: 'Μελέτησε με άλλα εργαλεία για να συγκεντρωθούν δεδομένα κατάκτησης και δραστηριότητας εδώ.',
    hint: 'Works even without uploaded material',
    hintEl: 'Λειτουργεί και χωρίς ανεβασμένο υλικό',
  },
  quiz: {
    icon: HelpCircle,
    title: 'No Quiz Questions',
    titleEl: 'Δεν υπάρχουν ερωτήσεις κουίζ',
    description: 'Upload material with glossary terms to unlock adaptive quizzes with IRT-based difficulty scaling.',
    descriptionEl: 'Ανέβασε υλικό με γλωσσάρι για προσαρμοστικά κουίζ με κλιμάκωση δυσκολίας IRT.',
    hint: 'Questions generated from glossary definitions',
    hintEl: 'Ερωτήσεις από ορισμούς γλωσσαρίου',
  },
};

export default function WorkspaceEmptyState({ toolId, hasSource, onUpload }: WorkspaceEmptyStateProps) {
  const { t } = useLanguage();
  const config = EMPTY_CONFIGS[toolId];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in-up">
      <div className="w-20 h-20 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-5 shadow-sm">
        <Icon className="w-9 h-9 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
        {t(config.title, config.titleEl)}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4 leading-relaxed">
        {t(config.description, config.descriptionEl)}
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-6 font-medium">
        {t(config.hint, config.hintEl)}
      </p>
      {!hasSource && onUpload && (
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md card-hover"
        >
          <Upload className="w-4 h-4" />
          {t('Upload Material', 'Ανέβασε Υλικό')}
        </button>
      )}
    </div>
  );
}
