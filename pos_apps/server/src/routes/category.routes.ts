import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const categoryRouter = Router();

categoryRouter.get('/', getCategories);
categoryRouter.post('/', authenticate, createCategory);
categoryRouter.put('/:id', authenticate, updateCategory);
categoryRouter.delete('/:id', authenticate, deleteCategory);
