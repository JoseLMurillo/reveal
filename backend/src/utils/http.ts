import type { Response } from "express";

export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number },
): void {
  res.status(200).json({
    data,
    meta: {
      ...meta,
      totalPages: meta.limit > 0 ? Math.ceil(meta.total / meta.limit) : 0,
    },
  });
}
