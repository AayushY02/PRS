import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ENV } from './env';
import { authRouter } from './routes/auth.routes';
import { regionsRouter } from './routes/regions.routes';
import { subareasRouter } from './routes/subareas.routes';
import { spotsRouter } from './routes/spots.routes';
import { bookingsRouter } from './routes/bookings.routes';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: ENV.CORS_ORIGIN, credentials: true }));

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/regions', regionsRouter);
app.use('/api/subareas', subareasRouter);
app.use('/api/spots', spotsRouter);
app.use('/api/bookings', bookingsRouter);

app.listen(ENV.PORT, () => {
  console.log(`API listening on http://localhost:${ENV.PORT}`);
});
