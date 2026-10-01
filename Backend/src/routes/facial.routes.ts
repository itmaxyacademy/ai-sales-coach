// src/routes/facial.routes.ts
import { Router } from 'express';
import { analyzeFrame } from '../controllers/facialController.js';

export const facialRouter = Router();

facialRouter.post('/analyze', analyzeFrame);