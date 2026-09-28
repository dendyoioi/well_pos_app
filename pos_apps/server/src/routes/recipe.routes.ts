import { Router } from 'express';
import {
  getRecipes,
  getRecipeByVariantId,
  getInventoryItemsForRecipe,
  createInventoryItem,
  upsertRecipe,
  deleteRecipe,
} from '../controllers/recipe.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const recipeRouter = Router();

recipeRouter.get('/', authenticate, getRecipes);
recipeRouter.get('/inventory-items', authenticate, getInventoryItemsForRecipe);
recipeRouter.post('/inventory-items', authenticate, createInventoryItem);
recipeRouter.get('/variant/:variantId', authenticate, getRecipeByVariantId);
recipeRouter.post('/', authenticate, upsertRecipe);
recipeRouter.delete('/:id', authenticate, deleteRecipe);
