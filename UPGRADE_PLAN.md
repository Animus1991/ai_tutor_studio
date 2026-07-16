# Έλεγχος repository και πλάνο αναβάθμισης

Η αναφορά βασίζεται στον πραγματικό κώδικα του Memora και όχι στα ιστορικά
έγγραφα “Synapse Learning”. Στόχος είναι η διατήρηση των υπαρχουσών ροών με
σταδιακή αύξηση ασφάλειας, αξιοπιστίας, ελεγξιμότητας και παραγωγικής
ωριμότητας.

## Μεθοδολογία

Ελέγχθηκαν:

- αρχιτεκτονική, routes, stores και βασικές ροές χρήστη,
- API contracts, authentication, authorization και Firestore rules,
- εισαγωγή/αποθήκευση δεδομένων, RAG, embeddings και FSRS,
- XSS, SSRF, PII, quotas, όρια πόρων και dependency surface,
- TypeScript, tests, build, CI, observability και reproducibility,
- PWA/offline συμπεριφορά, collaboration, WebRTC και cleanup,
- αντιστοιχία τεκμηρίωσης με τον εκτελέσιμο κώδικα.

Η σοβαρότητα προκύπτει από πιθανότητα εκμετάλλευσης ή αστοχίας, επίπτωση σε
δεδομένα/κόστος/λειτουργία και δυνατότητα ανίχνευσης.

## Αντικειμενική αποτύπωση

### Ισχυρά σημεία

- Πλούσιο λειτουργικό prototype με συνεκτικό React UI.
- Firebase Authentication/Firestore, IndexedDB και PWA υποδομή.
- Gemini proxy αντί έκθεσης του model key στον browser.
- Structured model responses σε κρίσιμες γεννήσεις.
- Vector retrieval, BM25, FSRS, source analysis και accessibility preferences.
- Error boundary, activity/audit primitives και offline fallbacks.

### Κρίσιμα ευρήματα αρχικής κατάστασης

| Περιοχή | Εύρημα | Επίπτωση | Κατάσταση |
| --- | --- | --- | --- |
| API | Όλα τα AI endpoints χωρίς auth/rate limit | Κατάχρηση quota και κόστους | Διορθώθηκε |
| Clipper | Αυθαίρετο server-side `fetch(url)` | SSRF/internal metadata access | Διορθώθηκε |
| Auth | Διπλό Firebase app και απώλεια session σε refresh | Runtime/login failures | Διορθώθηκε |
| RAG | Clients έστελναν `text`, server περίμενε `context` | Κενό grounding/hallucinations | Διορθώθηκε |
| XSS | Raw editor HTML, Mermaid SVG και error `innerHTML` | Εκτέλεση μη έμπιστου markup | Διορθώθηκε |
| Firestore | Απουσία rules για ενεργές collections | Permission failures/ασαφής πολιτική | Διορθώθηκε με owner rules |
| Logging | Ανύπαρκτα endpoints και αυθαίρετο file write | Silent loss/disk abuse | Διορθώθηκε |
| Resources | 50 MB JSON και unbounded multer | Memory exhaustion | Διορθώθηκε |
| Tests/CI | Καμία πραγματική δοκιμή ή pipeline | Regressions χωρίς έλεγχο | Διορθώθηκε ως βάση |
| Docs | Τα κύρια docs περιέγραφαν άλλο project | Λανθασμένες αποφάσεις συντήρησης | Διορθώθηκε ο πυρήνας |

### Υψηλά ευρήματα που απαιτούν προϊόν ή υποδομή

| Εύρημα | Γιατί δεν επιλύεται μόνο με ασφαλές local diff |
| --- | --- |
| Ανάθεση admin/instructor claims | Απαιτεί trusted Admin SDK/Cloud Function και επιχειρησιακή διαδικασία έγκρισης |
| Δημόσιο Yjs demo service | Απαιτεί authenticated Yjs deployment· τα Firestore rooms είναι ήδη random και membership-scoped |
| Firestore/localforage task dual-write | Απαιτεί κανόνες conflict resolution, offline queue και migration δεδομένων |
| Demo Calendar/Contacts/Classroom | Απαιτεί OAuth scopes, consent screen, token storage και product/privacy απόφαση |
| Mock image occlusion/admin analytics | Απαιτεί πραγματικό model/data source και ορισμό αποδεκτής ακρίβειας |
| GDPR/FERPA readiness | Απαιτεί νομική βάση, retention policy, DPA και διαδικασίες υποκειμένων δεδομένων |

Η παρουσία UI δεν παρουσιάζεται ως απόδειξη ολοκλήρωσης αυτών των backend ή
κανονιστικών δυνατοτήτων.

## Υλοποιημένες αναβαθμίσεις

### Ασφάλεια API

- Firebase ID tokens σε κάθε browser API request.
- Επαλήθευση JWT με Google Secure Token JWKS, project audience/issuer και RS256.
- Global και authenticated rate limits.
- Production CORS origin από `APP_URL`.
- Helmet headers και CSP.
- 1 MB JSON limit και 15 MB upload limit.
- Allowlist μοντέλων και όρια σε messages, prompts, contexts και notes.
- Server-side redaction κοινών PII πριν από Gemini calls.

### Web clipper

- Μόνο HTTP(S), χωρίς credentials.
- Απόρριψη localhost, private, loopback, link-local και reserved IP ranges.
- DNS validation σε αρχικό URL και κάθε redirect.
- Redirect, timeout, content type και response-size limits.

### Αξιοπιστία και ιδιωτικότητα

- Ενιαία Firebase αρχικοποίηση.
- Session restore με Firebase ID token.
- Backward-compatible RAG `context ?? text` και relevant-chunk prefilter.
- Πραγματικά `/api/logs` endpoints με bounded structured payload.
- Offline error ring buffer αντί απεριόριστου/εύθραυστου JSON.
- Cleanup Firestore/Yjs listeners και camera/microphone/WebRTC resources.
- Local bundled PDF worker αντί runtime CDN dependency.

### Data rules

- Email verification enforcement.
- Owner-only rules και validation για activity logs, documents, decks και
  flashcards.
- Ρητοί authenticated κανόνες για WebRTC signaling και y-fire paths.
- Τα collaboration reads παραμένουν link-based για συμβατότητα· δεν θεωρούνται
  tenant isolation.

### Ποιότητα

- Vitest tests για BM25, PII, vectors/chunking και SSRF primitives.
- Προστασία από malformed vectors και infinite-loop overlap.
- GitHub Actions για clean install, typecheck, tests, build και high-severity
  dependency audit.
- Καθορισμένο Node engine και reproducible peer-dependency policy.
- Πραγματικό README, architecture και security runbook.
- Πλήρες TypeScript `strict` mode.
- Claim-derived authenticated roles με ασφαλές `student` fallback.
- Random collaboration room IDs και Firestore membership enforcement.
- Πραγματική τοπική task/course συμπεριφορά στο Demo Mode.
- Mobile safe-area layout, skip navigation, reduced-motion policy και τοπικό
  PWA icon.
- Privacy-minimized implicit learning profile με cold-start priors, confidence,
  adaptive RAG/chunking/review intervals και error-pattern analytics.
- Image/scanned-PDF OCR και Office document ingestion.
- Notes-only prerequisite/Bloom-aware theory–practice blueprint και ξεχωριστό
  search-grounded enrichment με υποχρεωτικό review warning.
- Gemini vision image occlusion (`/api/occlusion`) με confidence threshold.
- Ενοποιημένο FSRS πάνω σε `fsrs.js` (`src/lib/fsrs.ts`).
- Profiling opt-out toggle (Art. 21) και page-abandonment instrumentation.
- Offline local-task mutation queue με flush στο reconnect.
- Mastery dashboard από πραγματικά domain evidence (`summarizeProfileDomains`).

## Επόμενες φάσεις

### P0 — Πριν από διαχείριση πραγματικών εκπαιδευτικών δεδομένων

1. ✅ Ανάγνωση Firebase custom claims και αφαίρεση role selector από
   authenticated production sessions.
2. ✅ Random room IDs, invitations, membership metadata και Firestore rules.
3. Self-hosted authenticated Yjs/WebRTC signaling.
4. Trusted διαδικασία ανάθεσης custom claims.
5. Firebase App Check, key restrictions και emulator tests για rules.
6. Egress firewall ώστε το clipper να μην έχει τεχνική πρόσβαση σε private
   networks ακόμη και σε DNS-rebinding σενάρια.

Κριτήριο αποδοχής: δύο διαφορετικοί tenants δεν μπορούν να δουν room/admin/user
data ο ένας του άλλου με τροποποιημένο client.

### P1 — Ακεραιότητα και offline συγχρονισμός

1. ✅ Baseline IndexedDB offline mutation queue για local tasks (`offlineSyncQueue.ts`).
2. Idempotency keys, retry/backoff και conflict policy για Firestore writes.
3. Migration των υφιστάμενων `memora-tasks`/course keys.
4. ✅ Ενοποίηση των δύο FSRS υλοποιήσεων πάνω στο `fsrs.js`.
5. Ενοποίηση vector/BM25 retrieval με μετρήσιμη ranking αξιολόγηση.

Κριτήριο αποδοχής: offline create/update/delete συγχρονίζεται ακριβώς μία φορά
και οι συγκρούσεις παράγουν προβλέψιμο αποτέλεσμα.

### P1 — Testing και maintainability

1. ✅ Διόρθωση όλων των προϋπαρχόντων TypeScript errors και ενεργοποίηση `strict`.
2. ✅ ESLint flat config με blocking Rules of Hooks και phased accessibility diagnostics.
3. Component tests για login, upload, RAG error states και FSRS review.
4. ✅ Firebase Emulator contract tests για owner isolation, verification και room membership.
5. Playwright smoke tests για βασικά journeys.
6. Διάσπαση `DocumentWorkspace`, `Tasks` και `CollabRoom` σε hooks/services.

Κριτήριο αποδοχής: clean `npm run check`, strict typecheck και regression tests
για κάθε κρίσιμη ροή.

### P2 — Παραγωγικά integrations

1. Αντικατάσταση Calendar/Contacts/Classroom demos με backend OAuth flow.
2. Πραγματικό image-occlusion pipeline με confidence/UX fallback.
3. Analytics από activity/session data αντί τυχαίων ή hardcoded τιμών.
4. Audit export από IndexedDB/Firestore με retention και deletion.
5. Model/version configuration, quota budgets και circuit breakers.

Κριτήριο αποδοχής: κάθε UI metric και integration δηλώνει source, freshness,
failure mode και demo/production status.

### P2 — Παρατηρησιμότητα και λειτουργία

1. Structured logger προς managed sink με correlation/request IDs.
2. Metrics για latency, model errors, token usage, rate limits και ingestion.
3. SLOs και alerts χωρίς αποθήκευση prompt/PII στα logs.
4. Backup/restore drill, Firestore indexes και cost budgets.
5. Staged deployment, rollback και dependency update automation.

### P3 — Απόδοση και προσβασιμότητα

1. Route/component lazy loading και bundle budget.
2. Virtualization μεγάλων lists/graphs και worker-based parsing.
3. WCAG 2.2 AA audit, keyboard/focus tests και reduced-motion policy.
4. ✅ Τοπικό PWA icon και ασφαλές update prompt· απομένουν ολοκληρωμένα offline behavior tests.
5. Internationalization και locale-aware dates/content.

## Μετρήσεις επιτυχίας

- 0 unauthenticated paid AI operations.
- 0 private-network clipper requests σε security tests.
- 100% owner isolation για user collections.
- 100% επιτυχία clean install/typecheck/test/build στο CI.
- Κάλυψη όλων των κρίσιμων journeys, όχι απλώς υψηλό συνολικό line coverage.
- Μετρημένο p95 latency και error rate ανά API route.
- Μηδενικά high/critical dependency advisories στην release gate.
- Τεκμηρίωση και UI που διακρίνουν ρητά demo από production δυνατότητες.

## Μη παλινδρόμηση

Κάθε επόμενη αλλαγή πρέπει:

1. να διατηρεί route/API compatibility ή να παρέχει migration,
2. να έχει test για το διορθωμένο failure mode,
3. να μην αποδυναμώνει auth/rules/CSP για να «περάσει» ένα integration,
4. να μην εμφανίζει mock output ως πραγματικό,
5. να περνά `npm run check` και το security checklist.
