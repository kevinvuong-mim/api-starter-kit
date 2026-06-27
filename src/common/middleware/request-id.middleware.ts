import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export type RequestWithId = Request & { requestId: string };

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

  (req as RequestWithId).requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
