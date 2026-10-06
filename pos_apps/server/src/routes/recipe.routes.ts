import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getRecipes,
  getRecipeByVariantId,
  getInventoryItemsForRecipe,
  createInventoryItem,
  upsertRecipe,
  deleteRecipe,
} from '../controllers/recipe.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const recipeRouter = Router();

recipeRouter.get('/', authenticate, getRecipes);
recipeRouter.get('/inventory-items', authenticate, getInventoryItemsForRecipe);
recipeRouter.post('/inventory-items', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), createInventoryItem);
recipeRouter.get('/variant/:variantId', authenticate, getRecipeByVariantId);
recipeRouter.post('/', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), upsertRecipe);
recipeRouter.delete('/:id', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), deleteRecipe);
