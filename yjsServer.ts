import type { Server } from 'http';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from '@y/websocket-server/utils';
import { getAdminFirestore } from './firebaseAdmin.js';
import {
  evaluateRoomAccess,
  firestoreRoomIdFromYjsDoc,
} from './server/authz.js';
import { verifyFirebaseIdToken } from './server/firebaseToken.js';

/** Room document names must be unguessable enough for collab. */
const ROOM_DOC_PATTERN = /^\/?[a-zA-Z0-9_-]{8,128}$/;

export type YjsAttachOptions = {
  projectId: string;
  /**
   * When true (typically REQUIRE_API_AUTH), anonymous WS upgrades are rejected.
   * Membership is enforced via Firestore rooms when Admin SDK is available.
   */
  requireAuth: boolean;
};

function writeHttpError(socket: { write: (s: string) => void; destroy: () => void }, status: number, message: string) {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/** Attach a Yjs-compatible websocket endpoint at `/yjs/*` on the HTTP server. */
export function attachYjsWebSocketServer(
  httpServer: Server,
  options?: YjsAttachOptions,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const projectId = options?.projectId ?? '';
  const requireAuth = Boolean(options?.requireAuth);

  httpServer.on('upgrade', (request, socket, head) => {
    void (async () => {
      if (!request.url) {
        socket.destroy();
        return;
      }

      const host = request.headers.host ?? 'localhost';
      let url: URL;
      try {
        url = new URL(request.url, `http://${host}`);
      } catch {
        socket.destroy();
        return;
      }
      const pathname = url.pathname;
      if (!pathname.startsWith('/yjs')) {
        // Another upgrade handler may own this path — do not destroy.
        return;
      }

      const docPath = pathname.slice('/yjs'.length) || '/';
      if (!ROOM_DOC_PATTERN.test(docPath)) {
        writeHttpError(socket, 400, 'Bad Request');
        return;
      }

      const roomId = firestoreRoomIdFromYjsDoc(docPath);
      const token =
        url.searchParams.get('token') ||
        url.searchParams.get('access_token') ||
        null;

      let uid: string | null = null;
      let email: string | null = null;

      if (token) {
        if (!projectId) {
          writeHttpError(socket, 503, 'Service Unavailable');
          return;
        }
        try {
          const user = await verifyFirebaseIdToken(token, projectId);
          uid = user.uid;
          email = String(user.claims.email ?? '')
            .trim()
            .toLowerCase();
          if (user.claims.email_verified === false) {
            writeHttpError(socket, 403, 'Forbidden');
            return;
          }
        } catch {
          writeHttpError(socket, 401, 'Unauthorized');
          return;
        }
      }

      const db = await getAdminFirestore();
      const access = await evaluateRoomAccess({
        db,
        roomId,
        uid,
        email,
        requireAuth,
      });

      if (!access.allowed) {
        const status = access.reason === 'unauthenticated' ? 401 : 403;
        writeHttpError(socket, status, status === 401 ? 'Unauthorized' : 'Forbidden');
        return;
      }

      request.url = docPath.startsWith('/') ? docPath : `/${docPath}`;

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    })().catch(() => {
      try {
        writeHttpError(socket, 500, 'Internal Server Error');
      } catch {
        socket.destroy();
      }
    });
  });

  wss.on('connection', (conn, req) => {
    setupWSConnection(conn, req, { gc: true });
  });

  return wss;
}
