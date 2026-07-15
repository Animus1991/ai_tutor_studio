import { getAccessToken } from '../auth';

export class GoogleWorkspaceService {
  private static instance: GoogleWorkspaceService;
  private constructor() {}
  public static getInstance(): GoogleWorkspaceService {
    if (!GoogleWorkspaceService.instance) {
      GoogleWorkspaceService.instance = new GoogleWorkspaceService();
    }
    return GoogleWorkspaceService.instance;
  }

  private async fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }

  public async createDocument(title: string, content: string): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    // 1. Create the document
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    });
    if (!createRes.ok) throw new Error("Failed to create Google Doc");
    const doc = await createRes.json();
    const documentId = doc.documentId;

    // 2. Insert text
    if (content) {
      const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content
              }
            }
          ]
        })
      });
      if (!updateRes.ok) throw new Error("Failed to insert text into Google Doc");
    }

    return `https://docs.google.com/document/d/${documentId}/edit`;
  }

  public async createPresentation(title: string): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    });
    if (!createRes.ok) throw new Error("Failed to create Google Slides presentation");
    const presentation = await createRes.json();
    
    return `https://docs.google.com/presentation/d/${presentation.presentationId}/edit`;
  }

  public async createForm(title: string): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        info: { title, documentTitle: title }
      })
    });
    if (!createRes.ok) throw new Error("Failed to create Google Form");
    const form = await createRes.json();
    
    return `https://docs.google.com/forms/d/${form.formId}/edit`;
  }

  public async saveToDrive(filename: string, content: string, mimeType: string): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const metadata = {
      name: filename,
      mimeType: mimeType
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: mimeType }));

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: form
    });
    if (!res.ok) throw new Error("Failed to upload to Google Drive");
    const file = await res.json();
    
    return file.id;
  }
  public async createChatSpace(displayName: string): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const res = await fetch('https://chat.googleapis.com/v1/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        displayName,
        spaceType: 'SPACE'
      })
    });
    if (!res.ok) throw new Error("Failed to create Google Chat space");
    const space = await res.json();
    return space.name; // e.g. "spaces/123"
  }
  public async createSpreadsheet(title: string, data: any[][]): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title }
      })
    });
    if (!createRes.ok) throw new Error("Failed to create Google Spreadsheet");
    const spreadsheet = await createRes.json();
    const spreadsheetId = spreadsheet.spreadsheetId;

    if (data && data.length > 0) {
      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: data
        })
      });
      if (!updateRes.ok) throw new Error("Failed to append data to Google Spreadsheet");
    }

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  }
  public async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const email = [
      `To: ${to}`,
      'Content-type: text/html;charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: =?utf-8?B?${btoa(subject)}?=`,
      '',
      body
    ].join('\r\n');

    const encodedEmail = btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: encodedEmail
      })
    });

    if (!res.ok) throw new Error("Failed to send email via Gmail");
  }
  public async createKeepNote(title: string, content: string): Promise<string> {
    const res = await this.fetchWithAuth('https://keep.googleapis.com/v1/notes', {
      method: 'POST',
      body: JSON.stringify({
        title,
        body: { text: { text: content } },
      }),
    });
    if (!res.ok) {
      console.warn('Keep API may require Google Workspace Enterprise domain.', res.status);
      throw new Error(`Failed to create Keep note (${res.status})`);
    }
    const data = await res.json() as any;
    return `https://keep.google.com/#NOTE/${data.name?.split('/')[1] || ''}`;
  }
  public async createMeetSpace(): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const res = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!res.ok) throw new Error("Failed to create Google Meet space");
    const space = await res.json();
    return space.meetingUri;
  }

  public async listClassroomCourses(): Promise<any[]> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    const res = await fetch('https://classroom.googleapis.com/v1/courses', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error("Failed to fetch Google Classroom courses");
    const data = await res.json();
    return data.courses || [];
  }
}

export const googleWorkspaceService = GoogleWorkspaceService.getInstance();
