import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebsocketProvider } from 'y-websocket';
import { useState, useEffect } from 'react';
import { getCollabWebSocketUrl } from './collabProvider';

export class CrdtStore {
  public doc: Y.Doc;
  public provider: WebsocketProvider | null = null;
  public persistence: IndexeddbPersistence | null = null;
  private roomName: string;

  constructor(roomName: string = 'memora-global-crdt') {
    this.roomName = roomName;
    this.doc = new Y.Doc();

    this.persistence = new IndexeddbPersistence(this.roomName, this.doc);

    this.persistence.on('synced', () => {
      console.log(`[CRDT] Loaded offline data for room: ${this.roomName}`);
    });

    if (typeof window !== 'undefined') {
      try {
        const wsUrl = getCollabWebSocketUrl();
        this.provider = new WebsocketProvider(wsUrl, this.roomName, this.doc, {
          connect: true,
          maxBackoffTime: 5000,
        });
        this.provider.on('status', (event: { status: string }) => {
          if (event.status === 'connected') {
            console.info(`[CRDT] Connected to room: ${this.roomName}`);
          }
        });
      } catch (e) {
        console.warn('Failed to initialize Websocket Provider for CRDT', e);
      }
    }
  }

  public getMap<T = unknown>(name: string): Y.Map<T> {
    return this.doc.getMap<T>(name);
  }

  public getArray<T = unknown>(name: string): Y.Array<T> {
    return this.doc.getArray<T>(name);
  }

  public getText(name: string): Y.Text {
    return this.doc.getText(name);
  }

  public destroy() {
    this.provider?.destroy();
    this.doc.destroy();
  }
}

export const globalCrdtStore = new CrdtStore('memora-app-global');

export function useYjsText(name: string, initialContent: string = '') {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    const yText = globalCrdtStore.getText(name);

    const handleUpdate = () => {
      setContent(yText.toString());
    };

    setContent(yText.toString() || initialContent);

    yText.observe(handleUpdate);
    return () => yText.unobserve(handleUpdate);
  }, [name, initialContent]);

  const updateContent = (newText: string) => {
    const yText = globalCrdtStore.getText(name);
    if (yText.toString() !== newText) {
      yText.delete(0, yText.length);
      yText.insert(0, newText);
    }
  };

  return [content, updateContent] as const;
}
