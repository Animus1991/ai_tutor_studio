import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import { useState, useEffect } from 'react';

export class CrdtStore {
  public doc: Y.Doc;
  public provider: WebrtcProvider | null = null;
  public persistence: IndexeddbPersistence | null = null;
  private roomName: string;

  constructor(roomName: string = 'memora-global-crdt') {
    this.roomName = roomName;
    this.doc = new Y.Doc();

    // Offline persistence
    this.persistence = new IndexeddbPersistence(this.roomName, this.doc);
    
    this.persistence.on('synced', () => {
      console.log(`[CRDT] Loaded offline data for room: ${this.roomName}`);
    });

    // Real-time syncing (disabled during server build, safe to run in browser)
    if (typeof window !== 'undefined') {
      try {
        this.provider = new WebrtcProvider(this.roomName, this.doc, {
          signaling: ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com']
        });
      } catch (e) {
        console.warn('Failed to initialize WebRTC Provider for CRDT', e);
      }
    }
  }

  public getMap<T = any>(name: string): Y.Map<T> {
    return this.doc.getMap<T>(name);
  }

  public getArray<T = any>(name: string): Y.Array<T> {
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

    // If it's empty but we have initialContent, maybe initialize it, 
    // but only if it's completely empty and not just deleted.
    if (yText.length === 0 && initialContent) {
       // yText.insert(0, initialContent);
    }
    
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
