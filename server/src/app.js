import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';

import authRouter from './modules/auth.js';
import studentsRouter from './modules/students.js';
import parentsRouter from './modules/parents.js';
import academicsRouter from './modules/academics.js';
import feesRouter from './modules/fees.js';

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '5mb' })); // allow base64 images for now

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'school-management-api' }));

  // Public
  app.use('/api/auth', authRouter);

  // Everything below requires a valid token
  app.use('/api', authenticate);
  app.use('/api/students', studentsRouter);
  app.use('/api/parents', parentsRouter);
  app.use('/api', academicsRouter); // /classes, /sections, /fee-heads, /settings
  app.use('/api/fees', feesRouter);

  // Unknown API route
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use(errorHandler);
  return app;
};
