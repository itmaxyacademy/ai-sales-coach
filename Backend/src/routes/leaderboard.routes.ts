import { Router } from 'express';
import { getLeaderboard } from '../controllers/leaderboardController.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', getLeaderboard);
