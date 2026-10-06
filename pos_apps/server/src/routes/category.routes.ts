import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const categoryRouter = Router();

categoryRouter.get('/', authenticate, getCategories);
categoryRouter.post('/', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), createCategory);
categoryRouter.put('/:id', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), updateCategory);
categoryRouter.delete('/:id', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), deleteCategory);
