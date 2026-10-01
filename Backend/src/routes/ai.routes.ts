import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
  generateCompanyContextHandler,
  generateQuickExamplesHandler,
  courseClarificationHandler,
  generateCourseConfirmedHandler,
  regenerateCourseSectionHandler,
} from '../controllers/aiController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });


// POST /api/ai/course-clarification (Interactive Ask-Back Step 1 -> 2)
// Body: multipart form or JSON { brief, industry?, productName?, targetPersona?, file? }
router.post('/course-clarification', upload.single('file'), courseClarificationHandler);

// POST /api/ai/generate-course-confirmed (Interactive Ask-Back Step 2 -> 3)
// Body: { brief, industry?, productName?, targetPersona?, clarifications: [{ id, question, answer }], documentText? }
router.post('/generate-course-confirmed', generateCourseConfirmedHandler);

// POST /api/ai/regenerate-course-section (Interactive Ask-Back Step 3 Section Regenerator)
// Body: { sectionKey, currentCourse, instruction? }
router.post('/regenerate-course-section', regenerateCourseSectionHandler);

// POST /api/ai/generate-company-context
// Body: { brief?: string, url?: string }
router.post('/generate-company-context', upload.single('file'), generateCompanyContextHandler);

// GET /api/ai/quick-examples
router.get('/quick-examples', requireAuth, generateQuickExamplesHandler);

export default router;