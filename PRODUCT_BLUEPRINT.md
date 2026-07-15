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

### Θεωρία → μηχανισμός → metric → κίνδυνος

| Θεωρία | Μηχανισμός πλατφόρμας | Κύριος δείκτης | Κίνδυνος λανθασμένης εφαρμογής |
| --- | --- | --- | --- |
| Retrieval practice | attempt-first, recall/explain πριν reveal | delayed unassisted recall | συνεχές testing χωρίς feedback/ανάπαυση |
| Spacing/FSRS | versioned due dates, outcome updates | recall ανά λεπτό review | βελτιστοποίηση prediction αντί learning |
| Interleaving | μίξη συγχεόμενων skills μετά acquisition | discrimination/transfer | πρόωρη μίξη που εμποδίζει schema formation |
| Cognitive Load | bounded chunks, signaling, split-attention reduction | error/latency/drop-off ανά chunk | «λιγότερο κείμενο» χωρίς νοηματική συνοχή |
| Dual coding | concept map/diagram μόνο για ουσιώδεις σχέσεις | transfer + diagram comprehension | decorative media/redundancy |
| Desirable difficulties | spacing, generation, variable practice | delayed retention | δυσκολία χωρίς επιτυχία → εγκατάλειψη |
| Scaffolding/ZPD | hint ladder και fading | ανεξάρτητη επίδοση/hint dependence | μόνιμη βοήθεια ή πρόωρο fading |
| Bloom/Anderson–Krathwohl | objectives/items remember→create | coverage και transfer ανά level | labels χωρίς valid item design |
| Feynman/self-explanation | explain-back + source-grounded gaps | rubric score και misconception repair | fluency/verbosity ως ψευδής κατανόηση |
| Montessori-inspired | επιλογή ρυθμού, authentic manipulation, self-correction | autonomy + task performance | άκριτη μεταφορά παιδικού curriculum |
| Self-Determination | meaningful choices, competence feedback, relatedness | persistence μαζί με wellbeing | controlling points/streaks και overjustification |
| Bloom tutoring evidence | mastery loop, feedback, retest, human escalation | active-control learning effect | marketing υπόσχεση «2σ» |

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

### Πλήρης signal model και domain plasticity

- response time σε 250ms buckets, online mean/variance και bounded fatigue,
- outcome/error ανά question kind: recall, recognition, cloze, MC, explain,
  apply, transfer,
- canonical error families: retrieval gap, misconception, procedure, notation,
  careless, timeout, abandon,
- revisit/drop-off EWMA,
- continuous Rasch-like ability `θ∈[-3,3]` ανά opaque domain key,
- global→domain shrinkage: νέο domain κληρονομεί global prior και αποκτά πλήρες
  domain weight μετά από επαρκείς domain observations,
- το course title δεν αποθηκεύεται: χρησιμοποιείται deterministic opaque hash.

Η response-time αύξηση δεν ερμηνεύεται αυτόματα ως χαμηλή ικανότητα: μπορεί να
είναι fatigue, προσεκτική σκέψη, accessibility ανάγκη ή δύσκολο item.
`[ΥΠΟΘΕΣΗ]` Η τρέχουσα fatigue/IRT policy είναι engineering prior και απαιτεί
calibration με πραγματικά δεδομένα και fairness analysis.

### Διαφάνεια και user control

Το dashboard απαντά «γιατί προσαρμόστηκε;» με evidence counts, confidence,
retrieval estimate, response-time evidence και ενεργά overrides. Ο χρήστης
μπορεί να αλλάξει chunk size, feedback detail και review spacing ή να
επιστρέψει στην αυτόματη πολιτική. Το trade-off είναι ότι πλήρης τεχνική
εξήγηση αυξάνει cognitive load· γι’ αυτό χρησιμοποιείται progressive
disclosure και όχι αόρατη αυτοματοποίηση.

### Κατάσταση κώδικα

**Υλοποιημένο:** local/global και per-domain profile store, privacy-bounded event buffer, Agent
personalization, task/flashcard/Feynman/focus instrumentation, adaptive FSRS
multiplier, adaptive RAG/chunking, dashboard confidence/error patterns,
response-time variance/fatigue, continuous ability estimate, explanation,
manual overrides και export/reset.  
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

### Copyright και provenance

Η πλατφόρμα πρέπει να ζητά δήλωση δικαιώματος χρήσης, να αποθηκεύει
item-level license/provenance και να αποφεύγει εκτενή αναπαραγωγή τρίτου
έργου στην enrichment έξοδο. «Δημόσια προσβάσιμο» δεν σημαίνει ελεύθερο για
παράγωγα ή εμπορική χρήση. Χρειάζονται takedown/counter-notice, source deletion
propagation, policy για university materials και έλεγχος CC όρων
NC/ND/SA. Η κυριότητα του generated course εξαρτάται από δικαιοδοσία,
συμβάσεις και ανθρώπινη δημιουργική συμβολή· απαιτεί νομική γνωμοδότηση, όχι
μόνο product terms. Το παρόν είναι risk analysis, όχι νομική συμβουλή.

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
- Adjustable pacing παράγεται αλγοριθμικά και διαθέτει explicit local
  overrides σε chunk size, feedback density και review spacing.

### Γιατί αναμένονται να δουλεύουν

Retrieval/spacing έχουν άμεση evidence base. Concept maps και dual coding
βοηθούν μόνο όταν αναπαριστούν ουσιώδεις σχέσεις και δεν αυξάνουν extraneous
load. Feynman/Socratic modes είναι implementation patterns· δεν διαθέτουν από
μόνα τους ενιαίο, ισχυρό effect estimate και πρέπει να αξιολογηθούν. Sandbox
και authentic tasks στοχεύουν transfer, αλλά χρειάζονται domain rubrics.

## 5. Ανταγωνιστικό τοπίο & διαφοροποίηση

| Προϊόν | Κοινό | Πηγή περιεχομένου | Προσαρμογή | Business model / evidence caveat |
| --- | --- | --- | --- | --- |
| Coursera Coach | self-learners, institutions | partner courses/instructor files | contextual tutor, practice, Socratic activities | course/Plus/B2B· vendor observational outcomes, όχι επαρκές RCT |
| ALEKS | K–12/higher-ed STEM | McGraw Hill structured curriculum | knowledge-space checks/prerequisite readiness | access/institution licenses· ώριμο domain model, όχι ισοδύναμο με open notes |
| Knewton Alta | higher-ed gateway courses | Wiley/OER curated objectives | proficiency graph, just-in-time remediation | term/inclusive access· published evidence κυρίως associational |
| Docebo Harmony | enterprise L&D | permission-scoped LMS content | role-aware grounded tutor/search | quote SaaS/credits· λειτουργίες ≠ independent causal gains |
| DreamBox | K–8 | proprietary standards curriculum | embedded assessment/lesson adaptation | school/family licensing· effects μικρά και outcome-dependent |
| Khanmigo | learners/teachers/districts | Khan Academy + user tasks | Socratic hints και learning-history context | individual/district· evolving RCT evidence |
| LearnLM / Guided Learning | broad learners/educators | Gemini context/uploads | probing, stepwise multimodal guidance | consumer/API/education distribution· model preference ≠ learning outcome |
| Smart Sparrow | higher-ed authors | educator-authored simulations | author rules/branching/time-on-screen | legacy/acquired comparator· mixed domain trial results |
| Absorb Aura | enterprise/compliance | LMS/docs/SharePoint | skills/progress recommendations, grounded agent | quote SaaS + credits· vendor evidence |
| CYPHER Learning | business/academia | LMS knowledge base/generated courses | role/history/goals, adaptive paths | annual active-user + AI credits· no independent causal evaluation found |

### Τι είναι νέο και τι όχι

Δεν είναι νέο: chatbot, RAG, flashcards, knowledge graph, FSRS, OCR ή dashboard
μεμονωμένα. Η πιθανή διαφοροποίηση είναι η ενιαία αλυσίδα
**user-owned heterogeneous notes → provenance-aware curriculum →
privacy-minimized implicit adaptation → theory/practice interfaces →
auditable delayed-retention outcomes**. Αυτή είναι προϊόντική υπόθεση μέχρι να
επικυρωθεί αιτιακά.

### Defensibility

Τα ορατά features μπορούν να αντιγραφούν γρήγορα. `[ΥΠΟΘΕΣΗ]` Το βιώσιμο moat
δεν είναι τα ιδιωτικά notes ως lock-in, αλλά: Greek-native evaluation/OCR και
terminology, legally licensed source graph, longitudinal delayed-outcome data
με νόμιμη βάση, preregistered efficacy, institutional privacy/accessibility
operations και distribution relationships. Η φορητότητα δεδομένων παραμένει
απαίτηση· η παρακράτηση προσωπικού περιεχομένου δεν είναι θεμιτό moat.

## 6. Επιχειρηματικό μοντέλο & βιωσιμότητα

### Προτεινόμενα tiers

- **Local Demo:** δωρεάν, local-only, χωρίς paid AI.
- **Individual:** bounded generations, OCR, tutor και scheduling.
- **Pro:** υψηλότερα quotas, grounded enrichment, exports και advanced
  analytics.
- **Institution:** SSO, tenant isolation, teacher approval, retention policy,
  audit/LRS, accessibility SLA και seat licensing.
- Προαιρετικό pay-per-course-generation μόνο για πολύ μεγάλα/OCR-heavy jobs.

| Μοντέλο | Πλεονέκτημα | Μειονέκτημα/guardrail |
| --- | --- | --- |
| Subscription | προβλέψιμο ARR και UX | heavy users μπορούν να καταστρέψουν margin· quotas/caching |
| Pay-per-generation | κόστος ευθυγραμμισμένο με OCR/generation | friction και αποθάρρυνση experimentation |
| B2B seats | υψηλότερο WTP, distribution | procurement, SSO, DPIA, support και efficacy burden |
| White-label | partner distribution | fragmentation, custom work και diluted brand |

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

### Unit economics

Ανά generated course με `I` input tokens, `O` output tokens και `S` grounded
queries: `COGS_course = I·r_in + O·r_out + S·r_search + OCR/storage/egress`.
Ανά active learner προστίθενται tutor turns, embeddings, observability και
support. Μετρώνται p50/p95, όχι μόνο average. `[ΥΠΟΘΕΣΗ]` Pricing επιτρέπεται
μόνο όταν contribution margin παραμένει θετικό στο p95 και οι quotas δεν
υποβαθμίζουν το learning journey.

### Segment και go-to-market

`[ΥΠΟΘΕΣΗ]` Πρώτος στόχος: ελληνόφωνοι university/self-learners σε απαιτητικά
θεωρητικά/τεχνικά μαθήματα, επειδή διαθέτουν δικές τους σημειώσεις και μικρότερο
institutional sales cycle. Corporate/institution tier ακολουθεί μόνο μετά από
tenant isolation, DPA/SSO και efficacy. Κανάλια: educator pilots, φοιτητικές
κοινότητες, shareable read-only courses με consent, content γύρω από εξετάσεις
και partnerships με φροντιστήρια. Viral loops δεν πρέπει να εκθέτουν notes.

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

### KPIs

- delayed unassisted retention και unseen transfer ανά λεπτό,
- mastery improvement από preregistered pre/post active control,
- D7/D30 learning-qualified retention, όχι απλό login,
- hint dependence, answer-reveal rate και calibration,
- p50/p95 course cost/latency, gross margin ανά tier,
- conversion/churn/NPS μαζί με complaints και deletion success,
- unsupported-claim rate και subgroup/accessibility harms.

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

### Ενδεικτικά data schemas

`LearningProfile`: global sufficient statistics, opaque per-domain buckets,
response-time mean/variance, fatigue, Rasch-like `abilityTheta`, revisit/dropoff
rates, canonical error taxonomy, confidence, bounded parameters και explicit
user overrides. Δεν περιέχει course title ή note content.

`KnowledgeGraph`: `Course{id,tenantId,sourceIds,mode}`, `Concept{id,label,
sourceSpans,confidence}`, `Edge{source,target,type:prerequisite|related,
confidence,evidenceSpans}`, `Activity{mode,bloomLevel,prompt,successCriteria}`.
Κάθε external claim συνδέεται με source URI/license/retrievedAt.

### Scale και latency budgets

- Upload: άμεσο acknowledgment και asynchronous job ID για βαριά OCR/Office.
- Interactive tutor: `[ΥΠΟΘΕΣΗ]` p50 <2s first feedback, p95 <6s· streaming δεν
  υποκαθιστά correctness.
- Course generation: progress stages και resumability· όχι blocking request
  όταν ξεπερνά reverse-proxy timeout.
- Cost: small model για extraction/classification, stronger model μόνο για
  ambiguous reasoning, caching και Batch για μη διαδραστικά jobs.
- Multi-tenant vector/RAG filters, per-tenant encryption keys όπου απαιτείται,
  backpressure, idempotency και dead-letter queue.

### Release gates

Strict typing, ESLint, unit tests, Firestore contracts, build, runtime
production-dependency audit, prompt/model evals, accessibility smoke,
hallucination/source-entailment sample και delayed-learning experiment.

Το λεπτομερές τεχνικό roadmap βρίσκεται στο `UPGRADE_PLAN.md`. Αυτό το έγγραφο
είναι product/research contract: κάθε claim πρέπει να αντιστοιχεί σε κώδικα,
test ή ρητή ένδειξη roadmap/mock.

## 8. Ασφάλεια δεδομένων, ιδιωτικότητα & ηθικά ζητήματα

> Τεχνική/product ανάλυση, όχι νομική συμβουλή. Απαιτείται DPO/νομικός και
> επιβεβαίωση ελληνικού/ευρωπαϊκού εκπαιδευτικού δικαίου.

Σημειώσεις, conversations, error patterns και inferred mastery είναι προσωπικά
δεδομένα όταν συνδέονται με χρήστη. Μπορεί να περιέχουν ειδικές κατηγορίες
άρθρου 9. Behavioral adaptation είναι profiling κατά GDPR 4(4), ακόμη και όταν
δεν χρησιμοποιεί όνομα.

### Governance

- Data inventory/ROPA με controller/processor ρόλους ανά D2C/B2B deployment.
- Άρθρο 6 βάση ανά σκοπό· το «contract» καλύπτει μόνο αντικειμενικά αναγκαία
  επεξεργασία. Προαιρετικό profiling χρειάζεται πραγματικό opt-out/fixed policy
  ή τεκμηριωμένη άλλη βάση.
- Άρθρα 13–15: signals, logic, confidence, consequences, retention,
  subprocessors και meaningful access σε observed/inferred data.
- Άρθρο 20: machine-readable notes/activity export· καλή πρακτική να
  περιλαμβάνεται και inferred profile.
- Άρθρο 21: stop profiling, όχι απλό hide/reset UI.
- Άρθρο 22: αν profile επηρεάζει βαθμό, certification ή πρόσβαση, αποφεύγεται
  solely automated significant decision και παρέχεται ουσιαστική human review,
  contest και override.
- DPIA πριν από production profiling, ειδικά για παιδιά, large-scale scoring
  ή special-category data
  ([GDPR](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679),
  [EDPB profiling guidance](https://www.edpb.europa.eu/documents/guideline/automated-decision-making-and-profiling_en)).
- Art. 28 DPAs, subprocessor list, SCC/adequacy/transfer-impact assessment και
  processor deletion verification.

### Τεχνικά controls

Local-first sufficient statistics, opaque domain keys, event TTL/caps,
tenant isolation, encryption/lifecycle, no model training from notes by
default, complete account deletion (notes, vectors, events, AI logs, backups),
incident response και tested DSAR. Το υφιστάμενο reset profile είναι μερικό:
full server/account erasure παραμένει roadmap.

### Over-reliance και autonomy

Attempt-first, confidence-before-answer, hint ladder, explain-back μετά direct
answer, delayed no-AI retrieval και human escalation. Primary KPI είναι
unassisted retention/transfer, όχι messages. Bastani et al. (2025) βρήκαν ότι
unrestricted GPT μπορούσε να βελτιώσει assisted performance αλλά να βλάψει
subsequent unassisted exam performance
([DOI](https://doi.org/10.1073/pnas.2422633122)); αυτό δεν γενικεύεται
αυτόματα, αλλά δικαιολογεί forcing functions και causal monitoring.

Hard ethical stops: μη διαγράψιμα δεδομένα, κρυφό training reuse, diagnosis
ADHD/dyslexia από clicks, significant automated decision χωρίς review,
subgroup harm ή immediate completion με χαμηλότερο delayed outcome.

## 9. Προσβασιμότητα & γλωσσική κάλυψη

### Accessibility

Στόχος WCAG 2.2 AA για critical journeys και generated content
([W3C](https://www.w3.org/TR/WCAG22/)), συμπληρωμένος με COGA guidance
([W3C COGA](https://www.w3.org/TR/coga-usable/)). Απαιτούνται keyboard/focus,
reflow/zoom/text spacing, labels/errors, non-drag alternatives, captions,
formula/table/diagram semantics, accessible authentication, enough time και
user-controlled motion. Automated lint δεν αποτελεί conformance audit.

Dyslexia font, bionic display, spacing και TTS είναι preferences/accessibility,
όχι efficacy ή diagnosis claims. Για ADHD παρέχονται predictable layout,
resumption point, customizable chunks, opt-in reminders και non-punitive pause·
δεν υπάρχει ενιαίο «ADHD mode».

### Greek-first

Τα Ελληνικά είναι source/evaluation language, όχι τελευταίο translation layer:

- native UI/errors/privacy/pedagogical prompts,
- preservation τόνων, διαλυτικών, τελικού σίγμα, code-switching/Greeklish,
- Greek-aware OCR/tokenization/retrieval/TTS/STT evaluation,
- domain terminology glossary με user locks,
- native educator rubrics και private holdout,
- citation precision, unsupported claims και cross-language leakage metrics,
- item-level license review για ebooks.edu.gr/Φωτόδεντρο· δημόσιο ≠ ελεύθερο.

Κάθε νέα γλώσσα είναι versioned language pack με native reviewer, locale/CLDR,
retrieval/OCR evaluation, accessibility pass και content policy. `[ΥΠΟΘΕΣΗ]`
Η σειρά expansion καθορίζεται από validated demand/evaluator capacity, όχι
μόνο από model language lists.

## 10. Οδικός χάρτης υλοποίησης (validation-gated)

Δεν χρησιμοποιούνται ημερολογιακές εκτιμήσεις. Κάθε gate οδηγεί σε advance,
iterate ή stop με preregistered thresholds μετά baseline/power analysis.

| Gate | Scope | Evidence πριν από advance |
| --- | --- | --- |
| 0 Claim discipline | audience/job/baseline | versioned claims register· κανένα «effective/personalized» χωρίς metric |
| 1 Privacy/security | data flows, legal bases, deletion | ROPA/DPIA/DPAs, tested export/delete, acceptable residual risk |
| 2 Greek grounded pipeline | notes→curriculum→activities | native blind review, source-span coverage, OCR/retrieval/license error analysis |
| 3 Theory MVP | Reader, retrieval, Feynman, FSRS | active-control delayed retention και acceptable unsupported-claim rate |
| 4 Practice runner | worked→faded→independent sandbox | transfer gain, falling hint dependence, safe execution |
| 5 Adaptive policy | global/per-domain profile | preregistered adaptive vs fixed policy χωρίς subgroup/overreliance harm |
| 6 Accessibility | WCAG/COGA critical journeys | independent manual audit και tests με assistive-tech users |
| 7 Product/economics | WTP, repeated value, COGS | learning-qualified retention, p50/p95 margin/latency, fair cancellation |
| 8 Institution | governance/teacher control | SSO, tenant isolation, audit, override, deletion/incident drills |
| 9 Multilingual | language pack | native benchmarks/reviewers και καμία πτώση Greek quality |

Hard stop: unresolved high-risk DPIA, personal-data leakage, critical
accessibility blocker, harmful unassisted outcomes, unacceptable hallucination
rate ή business model που απαιτεί excessive AI use/training reuse.

Το current repository έχει περάσει gates τεχνικής ποιότητας (strict typing,
tests, Firestore contracts, build, audit), αλλά **δεν** έχει περάσει causal
learning efficacy, institutional GDPR, independent WCAG ή multilingual gates.
