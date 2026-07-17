import type { Server } from 'http';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from '@y/websocket-server/utils';

/** Room document names must be unguessable enough for trust-on-link collab. */
const ROOM_DOC_PATTERN = /^\/?[a-zA-Z0-9_-]{8,128}$/;

/** Attach a Yjs-compatible websocket endpoint at `/yjs/*` on the HTTP server. */
export function attachYjsWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    if (!request.url) {
      socket.destroy();
      return;
    }

    const host = request.headers.host ?? 'localhost';
    const pathname = new URL(request.url, `http://${host}`).pathname;
    if (!pathname.startsWith('/yjs')) {
      socket.destroy();
      return;
    }

    const docPath = pathname.slice('/yjs'.length) || '/';
    if (!ROOM_DOC_PATTERN.test(docPath)) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    request.url = docPath.startsWith('/') ? docPath : `/${docPath}`;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (conn, req) => {
    setupWSConnection(conn, req, { gc: true });
  });

  return wss;
}
