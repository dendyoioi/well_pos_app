import { Router } from 'express';
import {
  getModifierGroups,
  upsertModifierGroup,
  linkProductModifiers,
  deleteModifierGroup,
} from '../controllers/modifier.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const modifierRouter = Router();

modifierRouter.get('/', authenticate, getModifierGroups);
modifierRouter.post('/', authenticate, upsertModifierGroup);
modifierRouter.post('/link-product', authenticate, linkProductModifiers);
modifierRouter.delete('/:id', authenticate, deleteModifierGroup);
