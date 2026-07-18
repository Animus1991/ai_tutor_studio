// A simplified xAPI standard structure
import { apiRequest } from './apiClient';

export interface XapiStatement {
  actor: {
    mbox: string;
    name: string;
  };
  verb: {
    id: string;
    display: { [key: string]: string };
  };
  object: {
    id: string;
    definition: {
      name: { [key: string]: string };
      description?: { [key: string]: string };
      type?: string;
    };
  };
  result?: {
    score?: {
      scaled: number;
      raw: number;
      min: number;
      max: number;
    };
    success?: boolean;
    completion?: boolean;
    duration?: string;
  };
  timestamp: string;
}

/** Local retention: 90 days · max 500 statements (mirrors server policy). */
const XAPI_LOCAL_MAX = 500;
const XAPI_LOCAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;

class XapiTracker {
  private getStatements(): XapiStatement[] {
    const stmts = localStorage.getItem('memora-xapi-statements');
    const parsed: XapiStatement[] = stmts ? JSON.parse(stmts) : [];
    const cutoff = Date.now() - XAPI_LOCAL_TTL_MS;
    return parsed.filter((s) => {
      const t = new Date(s.timestamp).getTime();
      return !Number.isNaN(t) && t >= cutoff;
    });
  }

  sendStatement(statement: Omit<XapiStatement, 'timestamp'>) {
    const fullStatement: XapiStatement = {
      ...statement,
      timestamp: new Date().toISOString()
    };

    const stmts = this.getStatements();
    stmts.push(fullStatement);
    const trimmed = stmts.slice(-XAPI_LOCAL_MAX);
    localStorage.setItem('memora-xapi-statements', JSON.stringify(trimmed));

    void apiRequest('/api/xapi/statements?meta=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullStatement),
    }).catch(() => {
      /* LRS optional — local cache remains source of truth offline */
    });

    if (import.meta.env.DEV) {
      console.log('[xAPI Statement]', fullStatement);
    }
  }

  logLessonCompletion(userId: string, lessonId: string, lessonName: string, success?: boolean, score?: number) {
    this.sendStatement({
      actor: {
        mbox: `mailto:${userId}@example.com`,
        name: userId
      },
      verb: {
        id: 'http://adlnet.gov/expapi/verbs/completed',
        display: { 'en-US': 'completed' }
      },
      object: {
        id: `http://memora.app/lessons/${lessonId}`,
        definition: {
          name: { 'en-US': lessonName },
          type: 'http://adlnet.gov/expapi/activities/lesson'
        }
      },
      result: {
        completion: true,
        success,
        ...(score !== undefined && {
          score: { raw: score, min: 0, max: 100, scaled: score / 100 }
        })
      }
    });
  }

  logQuizAttempt(userId: string, quizId: string, quizName: string, score: number) {
    this.sendStatement({
      actor: {
        mbox: `mailto:${userId}@example.com`,
        name: userId
      },
      verb: {
        id: 'http://adlnet.gov/expapi/verbs/attempted',
        display: { 'en-US': 'attempted' }
      },
      object: {
        id: `http://memora.app/quizzes/${quizId}`,
        definition: {
          name: { 'en-US': quizName },
          type: 'http://adlnet.gov/expapi/activities/assessment'
        }
      },
      result: {
        score: { raw: score, min: 0, max: 100, scaled: score / 100 }
      }
    });
  }
  logDocumentEngagement(userId: string, documentId: string, documentName: string, action: 'read' | 'annotated' | 'generated_diagram') {
    this.sendStatement({
      actor: {
        mbox: `mailto:${userId}@example.com`,
        name: userId
      },
      verb: {
        id: `http://adlnet.gov/expapi/verbs/${action}`,
        display: { 'en-US': action }
      },
      object: {
        id: `http://memora.app/documents/${documentId}`,
        definition: {
          name: { 'en-US': documentName },
          type: 'http://adlnet.gov/expapi/activities/document'
        }
      }
    });
  }
}

export const xapi = new XapiTracker();
