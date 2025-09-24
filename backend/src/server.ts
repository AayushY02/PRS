import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ENV } from './env.js';
import { authRouter } from './routes/auth.routes';
import { spotsRouter } from './routes/spots.routes';
import { bookingsRouter } from './routes/bookings.routes';
import regionsRouter from './routes/regions.routes.js';
import adminRegionsRouter from './routes/regions.admin.routes.js';
import { authOptional } from './middleware/authOptional';
import { liveStream } from './live.js';
import statsRouter from './routes/stats.routes.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin (cURL/health checks) and explicit matches
    if (!origin || ENV.CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/regions', regionsRouter);
app.use('/api/admin/regions', adminRegionsRouter);
app.use('/api/spots', spotsRouter);
app.use('/api/bookings', bookingsRouter);
app.get('/api/live', authOptional, liveStream);
app.use('/api/stats', statsRouter);

app.listen(ENV.PORT, () => {
  console.log(`API listening on http://localhost:${ENV.PORT}`);
});
