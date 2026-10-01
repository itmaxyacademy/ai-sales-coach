// src/routes/course.routes.ts
import { Router } from 'express';
import {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/courseController.js';

export const courseRouter = Router();

courseRouter.get('/', listCourses);
courseRouter.get('/:courseId', getCourse);
courseRouter.post('/', createCourse);
courseRouter.patch('/:courseId', updateCourse);
courseRouter.delete('/:courseId', deleteCourse);