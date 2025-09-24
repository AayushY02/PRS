import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db, schema } from '../db';
import { authRequired } from '../middleware/authRequired';
import { currentTokyoTimestamp, formatDateTimeISO, sanitizeForFilename, toCsvBuffer, toXlsxBuffer } from '../utils/exporters';

const usersRouter = Router();

const USER_EXPORT_HEADERS = ['ID', '\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9', '\u767b\u9332\u65e5\u6642'];

const UsersExportQuery = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
});

usersRouter.get('/export', authRequired, async (req: Request, res: Response) => {
  const parsed = UsersExportQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { format } = parsed.data;

  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(schema.users.createdAt);

  const tableRows = users.map((user) => {
    const createdAtIso = user.createdAt instanceof Date ? user.createdAt.toISOString() : null;
    return [
      user.id,
      user.email,
      formatDateTimeISO(createdAtIso, ''),
    ];
  });

  const timestamp = currentTokyoTimestamp();
  const fileBase = sanitizeForFilename('\u5229\u7528\u8005\u4e00\u89a7');
  const extension = format === 'xlsx' ? 'xlsx' : 'csv';
  const filename = `${fileBase}_${timestamp}.${extension}`;

  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  );

  if (format === 'xlsx') {
    const buffer = await toXlsxBuffer('\u5229\u7528\u8005\u4e00\u89a7', USER_EXPORT_HEADERS, tableRows);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } else {
    const buffer = toCsvBuffer(USER_EXPORT_HEADERS, tableRows);
    res.type('text/csv; charset=utf-8');
    res.send(buffer);
  }
});

export default usersRouter;
