// A simplified xAPI standard structure
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

class XapiTracker {
  private getStatements(): XapiStatement[] {
    const stmts = localStorage.getItem('memora-xapi-statements');
    return stmts ? JSON.parse(stmts) : [];
  }

  sendStatement(statement: Omit<XapiStatement, 'timestamp'>) {
    const fullStatement: XapiStatement = {
      ...statement,
      timestamp: new Date().toISOString()
    };
    
    const stmts = this.getStatements();
    stmts.push(fullStatement);
    localStorage.setItem('memora-xapi-statements', JSON.stringify(stmts));
    
    // In production, this would go to a Learning Record Store (LRS)
    console.log('[xAPI Statement]', fullStatement);
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
