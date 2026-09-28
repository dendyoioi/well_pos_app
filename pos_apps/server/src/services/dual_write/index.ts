export * from './types';
export * from './base.dual_write.service';
export * from './catalog.dual_write.service';
export * from './inventory.dual_write.service';
export * from './sales.dual_write.service';
export * from './user.dual_write.service';
export * from './location.dual_write.service';

import { CatalogDualWriteService } from './catalog.dual_write.service';
import { InventoryDualWriteService } from './inventory.dual_write.service';
import { SalesDualWriteService } from './sales.dual_write.service';
import { UserDualWriteService } from './user.dual_write.service';
import { LocationDualWriteService } from './location.dual_write.service';

/**
 * Singleton instances for convenient dependency injection
 */
export const catalogDualWriteService = new CatalogDualWriteService();
export const inventoryDualWriteService = new InventoryDualWriteService();
export const salesDualWriteService = new SalesDualWriteService();
export const userDualWriteService = new UserDualWriteService();
export const locationDualWriteService = new LocationDualWriteService();
