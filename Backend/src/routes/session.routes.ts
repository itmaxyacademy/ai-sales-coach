// src/routes/session.routes.ts - REPLACE
import { Router } from 'express';
import {
  startSession,
  chat,
  completeSession,
  getSessionResult,
  getSessionHistory,
  retrySession,
  getHint,
  updateSessionLanguage,
  beginSession,
  abandonSession,
  generateFollowUpDraft,
} from '../controllers/sessionController.js';

export const sessionRouter = Router();

sessionRouter.post('/start', startSession);
sessionRouter.post('/chat', chat);
sessionRouter.post('/complete', completeSession);
sessionRouter.get('/history', getSessionHistory);
sessionRouter.post('/:sessionId/retry', retrySession);
sessionRouter.post('/:sessionId/hint', getHint);
sessionRouter.post('/:sessionId/followup', generateFollowUpDraft);
sessionRouter.patch('/:sessionId/language', updateSessionLanguage);
sessionRouter.patch('/:sessionId/begin', beginSession);
sessionRouter.patch('/:sessionId/abandon', abandonSession);
sessionRouter.get('/:sessionId', getSessionResult);
