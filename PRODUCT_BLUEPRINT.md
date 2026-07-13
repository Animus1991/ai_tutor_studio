# Memora — Evidence-Based Product Blueprint και Έλεγχος Υλοποίησης

Κατάσταση ελέγχου: 13 Ιουλίου 2026. Οι χαρακτηρισμοί **Υλοποιημένο**,
**Μερικό**, **Mock** και **Απόν** βασίζονται στον εκτελέσιμο κώδικα· η ύπαρξη
UI ή εγγράφου δεν θεωρείται απόδειξη λειτουργικού backend.

## 1. Παιδαγωγικό θεμέλιο (evidence-based)

### Αρχές που μετατρέπονται σε αλγοριθμική συμπεριφορά

1. **Retrieval practice:** ανάκληση πριν από εμφάνιση απάντησης, άμεσο
   διορθωτικό feedback και delayed retest. Οι Roediger & Karpicke (2006)
   έδειξαν πλεονέκτημα delayed retention έναντι restudy
   ([DOI](https://doi.org/10.1111/j.1467-9280.2006.01693.x)). Η μετα-ανάλυση
   Rowland (2014) δείχνει ότι recall tests συνήθως υπερτερούν recognition
   ([DOI](https://doi.org/10.1037/a0037559)). Αυτό δεν σημαίνει ότι κάθε quiz
   ή κάθε domain έχει ίδιο effect size.
2. **Spacing:** τα intervals εξαρτώνται από τον επιθυμητό retention horizon,
   όχι από μία καθολική «forgetting curve» (Cepeda et al., 2006,
   [DOI](https://doi.org/10.1037/0033-2909.132.3.354)). Το Memora χρησιμοποιεί
   FSRS και bounded behavioral adjustment. Το FSRS έχει ισχυρά retrospective
   predictive benchmarks, όχι δημοσιευμένο preregistered head-to-head RCT
   έναντι SM-2 για transfer.
3. **Interleaving:** εφαρμόζεται όταν πρέπει να διακριθούν συγγενείς κατηγορίες.
   Η μετα-ανάλυση Brunmair & Richter (2019) βρήκε συνολικό g=0,42, αλλά αρνητικό
   αποτέλεσμα για λέξεις· άρα δεν εφαρμόζεται καθολικά
   ([DOI](https://doi.org/10.1037/bul0000209)).
4. **Cognitive load και expertise reversal:** worked example → completion
   problem → hints → ανεξάρτητη εκτέλεση, με fading καθώς αυξάνεται η
   τεκμηριωμένη επίδοση (Sweller, 1988,
   [DOI](https://doi.org/10.1207/s15516709cog1202_4); Kalyuga et al., 2003,
   [DOI](https://doi.org/10.1207/S15326985EP3801_4)).
5. **Scaffolding:** περιορισμός βαθμών ελευθερίας, ανάδειξη κρίσιμων στοιχείων,
   hint ladders και σταδιακή απόσυρση. Η computer-based scaffolding
   meta-analysis του Belland et al. (2017) ανέφερε g=0,46 με σημαντική
   ετερογένεια ([DOI](https://doi.org/10.3102/0034654316670999)).
6. **Dual coding / multimedia:** signaling, coherence, segmentation,
   contiguity και pre-training· όχι διακοσμητικά media. Η meta-meta-analysis
   Noetel et al. (2022) κάλυψε 29 reviews/1.189 μελέτες
   ([DOI](https://doi.org/10.3102/00346543211052329)).
7. **Self-determination:** meaningful autonomy, competence feedback και
   relatedness, χωρίς gamification που μετατρέπει τη μάθηση σε εξωτερικό
   reward loop (Howard et al., 2021,
   [DOI](https://doi.org/10.1177/1745691620966789)).

### Montessori σε ενήλικη ψηφιακή μάθηση

Μεταφέρσιμες σχεδιαστικές υποθέσεις: prepared environment, αυτο-ρυθμιζόμενη
πρόοδος εντός σαφών ορίων, χειρισμός αυθεντικών αντικειμένων/προσομοιώσεων,
self-correction και tutor-as-observer. Δεν μεταφέρονται χωρίς έρευνα το
παιδικό sensorial curriculum, τα age-banded materials ή ο ισχυρισμός ότι η
ελάχιστη παρέμβαση ωφελεί κάθε αρχάριο. Η Marshall (2017) χαρακτηρίζει την
παιδική evidence base ενθαρρυντική αλλά περιορισμένη
([DOI](https://doi.org/10.1038/s41539-017-0012-7)); δεν υπάρχει επαρκής άμεση
επικύρωση γενικής «Montessori για ενηλίκους».

### Learning styles: ρητό όριο

Το Memora **δεν** αποδίδει VARK/visual/auditory/kinesthetic ετικέτες. Η
meshing hypothesis δεν έχει την απαιτούμενη crossover evidence (Pashler et
al., 2008/2009,
[DOI](https://doi.org/10.1111/j.1539-6053.2009.01038.x)). Επιτρέπεται
instructional-method matching με βάση prior knowledge, είδος περιεχομένου,
συγκεκριμένο misconception, accessibility ανάγκη και μετρημένη επίδοση.

### Κατάσταση κώδικα

- **Υλοποιημένα:** FSRS σε Tasks/Flashcards, retrieval reviews, Feynman check,
  Socratic mode, Pomodoro, adaptive profile engine.
- **Μερικά:** interleaving, mastery estimation και scaffolding δεν έχουν ακόμη
  domain-level causal policy.
- **Απόντα:** confidence calibration bins και validated transfer-test engine.

Το «Bloom 2σ» δεν χρησιμοποιείται ως υπόσχεση. Το αρχικό αποτέλεσμα
συνδύαζε tutoring, mastery learning, corrective feedback και περισσότερο χρόνο
(Bloom, 1984, [DOI](https://doi.org/10.3102/0013189X013006004)). Reviews για
ITS αναφέρουν πολύ χαμηλότερα και ετερογενή effects.

## 2. Μηχανισμός implicit learning-profile detection

### Signals και data minimization

Το `learningProfile.ts` συλλέγει μόνο:

- review quality/success και coarse error category,
- διάρκεια focus σε πεντάλεπτα buckets,
- theory/practice interaction mode,
- text/voice/visual/retrieval channel usage,
- chunk size και ώρα δραστηριότητας.

Δεν αποθηκεύει prompt, απάντηση, filename, email ή document title. Τα τελευταία
500 events διατηρούνται τοπικά έως 90 ημέρες· το μόνιμο IndexedDB profile
περιέχει μόνο sufficient statistics και top error counts.

### Online update και cold start

- Population priors: retrieval success 0,65, chunk 500 λέξεις, focus 25 λεπτά.
- EWMA learning rate 0,08 με residual clipping.
- Personalization confidence: `min(eventCount / 40, 1)`.
- Πριν από 8–40 events οι παράμετροι shrink προς τον prior· δεν
  υπερ-ερμηνεύονται μεμονωμένα clicks.

### Μετατροπή σε παραμέτρους

- `ragTopK`: 3–6, αυξάνεται bounded όταν η retrieval evidence είναι ασθενής.
- `chunkSizeWords`: 300–800 και overlap 50–150.
- `retrievalIntervalMultiplier`: 0,6–1,6· υψηλότερη επαναλαμβανόμενη επιτυχία
  επιτρέπει μεγαλύτερα intervals.
- `theoryPracticeRatio`: 0,25–0,75, περιγραφικό behavioral signal και όχι
  διάγνωση ικανότητας.
- feedback density: detailed/balanced/minimal.
- suggested tutor mode και optimal study hour με εμφανές confidence.

### Κατάσταση κώδικα

**Υλοποιημένο:** local profile store, privacy-bounded event buffer, Agent
personalization, task/flashcard/Feynman/focus instrumentation, adaptive FSRS
multiplier, adaptive RAG/chunking, dashboard confidence/error patterns,
export/reset.  
**Επόμενη επιστημονική απαίτηση:** preregistered evaluation που συγκρίνει
adaptive policy με σταθερή policy σε delayed retention και transfer.

## 3. Αρχιτεκτονική μετατροπής σημειώσεων → μάθημα

### Pipeline

1. **Ingestion:** text/Markdown/CSV, PDF, OCR για εικόνες και scanned PDF,
   DOCX/PPTX/XLSX/ODT/ODP/RTF, YouTube transcript και SSRF-safe web clipper.
2. **Privacy:** client και server PII redaction.
3. **Source analysis:** density/readability/glossary και quality warnings.
4. **Concept extraction:** ontology nodes/edges και chunk embeddings.
5. **Curriculum:** course mode theory/practice/mixed, prerequisite edges,
   Bloom-aware objectives, cognitively coherent modules και activities με
   success criteria.
6. **Interface:** theory activities (explanation, comparison, retrieval,
   concept map) ή practice activities (worked example, completion problem,
   sandbox, transfer task).
7. **Scheduling:** generated tasks + FSRS review.

### Hallucination και enrichment controls

- Το blueprint endpoint είναι **notes-only** και απαγορεύει external claims.
- Το enrichment endpoint είναι ξεχωριστό, χρησιμοποιεί Google Search
  grounding, επιστρέφει source trail και `reviewRequired=true`.
- Το UI επισημαίνει «EXTERNAL ENRICHMENT — REVIEW REQUIRED».
- Απουσία source trail σημαίνει μη επαληθευμένο draft, όχι γνώση.
- Μελλοντικά απαιτείται domain-specific source allowlist, claim-level
  entailment check και human approval πριν από course publication.

### Κατάσταση

Η pipeline είναι πλέον **λειτουργικά μερική αλλά πραγματική**. Δεν υπάρχουν
ακόμη robust table/math OCR metrics, incremental course merge, provenance span
ανά concept ή teacher approval workflow.

## 4. Διαδραστικά εργαλεία (πέρα από τα βασικά)

### Θεωρητικά

- FSRS flashcards και retrieval queue.
- Concept/knowledge graph.
- Feynman explain-back με gap analysis.
- Socratic tutor.
- Grounded enrichment και citation trail.
- TTS, dictation, bionic/dyslexia display ως accessibility επιλογές.
- PDF reader, annotations, glossary, source-quality analysis.
- Mastery/adaptive dashboard και error-pattern analytics.
- Compare/debate/claim-evidence tables: **roadmap**, όχι υλοποιημένα.

### Πρακτικά

- Pyodide Python code blocks με feedback.
- Whiteboard και collaborative room.
- Image occlusion: **mock** και πρέπει να παραμένει χαρακτηρισμένο ως τέτοιο.
- Worked/completion/transfer activities στο curriculum contract· dedicated
  runner UI παραμένει roadmap.
- Adjustable pacing παράγεται αλγοριθμικά· explicit user override slider
  παραμένει roadmap.

### Γιατί αναμένονται να δουλεύουν

Retrieval/spacing έχουν άμεση evidence base. Concept maps και dual coding
βοηθούν μόνο όταν αναπαριστούν ουσιώδεις σχέσεις και δεν αυξάνουν extraneous
load. Feynman/Socratic modes είναι implementation patterns· δεν διαθέτουν από
μόνα τους ενιαίο, ισχυρό effect estimate και πρέπει να αξιολογηθούν. Sandbox
και authentic tasks στοχεύουν transfer, αλλά χρειάζονται domain rubrics.

## 5. Ανταγωνιστικό τοπίο & διαφοροποίηση

- **Coursera Coach:** course-grounded tutoring, summaries, practice και
  Socratic activities. Τα vendor observational metrics δεν είναι RCT.
- **ALEKS:** ώριμο prerequisite knowledge-space adaptation, ιδιαίτερα σε
  structured STEM. Το Memora δεν πρέπει να ισχυρίζεται ισοδύναμη psychometric
  ωριμότητα.
- **Knewton Alta:** just-in-time instruction/remediation σε έτοιμο courseware.
- **Docebo Harmony:** enterprise governance, semantic search και role-aware
  tutor σε οργανωσιακό περιεχόμενο.
- **DreamBox:** continuous formative adaptation σε K–8· evidence effects είναι
  θετικά αλλά μικρά και outcome-dependent.
- **Khanmigo:** content-integrated guided tutor με learning-history signals.
- **LearnLM/Gemini Guided Learning:** probing questions, uploads, diagrams,
  quizzes και teacher-led deployments.

### Τι είναι νέο και τι όχι

Δεν είναι νέο: chatbot, RAG, flashcards, knowledge graph, FSRS, OCR ή dashboard
μεμονωμένα. Η πιθανή διαφοροποίηση είναι η ενιαία αλυσίδα
**user-owned heterogeneous notes → provenance-aware curriculum →
privacy-minimized implicit adaptation → theory/practice interfaces →
auditable delayed-retention outcomes**. Αυτή είναι προϊόντική υπόθεση μέχρι να
επικυρωθεί αιτιακά.

## 6. Επιχειρηματικό μοντέλο & βιωσιμότητα

### Προτεινόμενα tiers

- **Local Demo:** δωρεάν, local-only, χωρίς paid AI.
- **Individual:** bounded generations, OCR, tutor και scheduling.
- **Pro:** υψηλότερα quotas, grounded enrichment, exports και advanced
  analytics.
- **Institution:** SSO, tenant isolation, teacher approval, retention policy,
  audit/LRS, accessibility SLA και seat licensing.
- Προαιρετικό pay-per-course-generation μόνο για πολύ μεγάλα/OCR-heavy jobs.

### Cost model

Με επίσημες τιμές Gemini 3.5 Flash τον Ιούλιο 2026: $1,50/1M input tokens,
$9/1M output tokens, cached input $0,15/1M και Search grounding μετά το shared
allowance $14/1.000 queries
([Google pricing](https://ai.google.dev/gemini-api/docs/pricing)). Μην
ενσωματώνονται ως μόνιμες constants.

`monthly COGS = inputTokens*rateIn + outputTokens*rateOut +
groundedQueries*rateSearch + storage/egress + observability/support`.

Pricing guardrail: gross margin stress test σε p50/p95 usage, hard per-user
budgets, context caching, small-model extraction και Batch για asynchronous
course generation.

### MVP

1. PDF/text/image upload.
2. Notes-only prerequisite curriculum.
3. Reader + retrieval quiz + Feynman + practical exercise.
4. FSRS queue.
5. Minimal implicit profile με visible uncertainty.
6. Delayed retention experiment με active-control fixed policy.

Δεν απαιτούνται αρχικά image generation, video meeting, full admin analytics,
Google Classroom ή 11 εργαλεία.

### Ρίσκα

Copyright/derivative enrichment, hallucination, sensitive student data,
model/provider cost, public Yjs transport, CAC απέναντι σε incumbents,
over-personalization από μικρά samples και regulatory claims. Απαιτούνται
source licensing, takedown workflow, DPA, retention/deletion, age policy και
human escalation.

## 7. Τεχνική στοίβα (πρόταση, όχι δέσμευση)

### Τρέχουσα

- React 19, TypeScript strict, Vite/PWA, Tailwind.
- Express API, Gemini, Helmet/rate limits/JWT.
- Firebase Auth/Firestore + Rules Emulator.
- IndexedDB/Zustand/localforage.
- BM25 + embeddings, Yjs/WebRTC, FSRS.

### Εξέλιξη

- Διατήρηση React/TypeScript.
- Χωριστό ingestion worker queue για OCR/Office/embedding jobs.
- Versioned pedagogy service και scheduler interface.
- PostgreSQL/warehouse μόνο όταν απαιτηθούν institution-level aggregates· όχι
  πρόωρα.
- Object storage με encryption/lifecycle για source files.
- Vector index με tenant filters όταν το client-side index δεν επαρκεί.
- Authenticated self-hosted Yjs και TURN.
- OpenTelemetry χωρίς prompt content, cost/latency/error metrics.
- Feature flags και experiment assignment για causal evaluation.

### Release gates

Strict typing, ESLint, unit tests, Firestore contracts, build, runtime
production-dependency audit, prompt/model evals, accessibility smoke,
hallucination/source-entailment sample και delayed-learning experiment.

Το λεπτομερές τεχνικό roadmap βρίσκεται στο `UPGRADE_PLAN.md`. Αυτό το έγγραφο
είναι product/research contract: κάθε claim πρέπει να αντιστοιχεί σε κώδικα,
test ή ρητή ένδειξη roadmap/mock.
