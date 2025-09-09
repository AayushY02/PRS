// backend/src/live.ts
import type { Request, Response } from 'express';

type Client = { id: number; res: Response; userId?: string | null };
let clients: Client[] = [];
let nextId = 1;

export function liveStream(req: Request, res: Response) {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const id = nextId++;
  const userId = (req as any).userId ?? null;

  // initial ping
  res.write(`event: ping\ndata: ${Date.now()}\n\n`);

  const client: Client = { id, res, userId };
  clients.push(client);

  const hb = setInterval(() => {
    try { res.write(`event: ping\ndata: ${Date.now()}\n\n`); } catch {}
  }, 25000);

  req.on('close', () => {
    clearInterval(hb);
    clients = clients.filter(c => c.id !== id);
  });
}

export function broadcastBooking(
  event: 'start' | 'end',
  payload: { subSpotId: string; userId: string; startTime?: string | null }
) {
  const msg = `event: booking\ndata: ${JSON.stringify({ event, ...payload })}\n\n`;
  for (const c of clients) {
    try { c.res.write(msg); } catch {}
  }
}
