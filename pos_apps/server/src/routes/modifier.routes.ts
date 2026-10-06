import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getModifierGroups,
  upsertModifierGroup,
  linkProductModifiers,
  deleteModifierGroup,
} from '../controllers/modifier.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const modifierRouter = Router();

modifierRouter.get('/', authenticate, getModifierGroups);
modifierRouter.post('/', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), upsertModifierGroup);
modifierRouter.post('/link-product', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), linkProductModifiers);
modifierRouter.delete('/:id', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), deleteModifierGroup);
