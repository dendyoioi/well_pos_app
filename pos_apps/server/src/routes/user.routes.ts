import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller';

const router = Router();

// Semua rute user manajemen memerlukan autentikasi login
router.use(authenticate);

// Hanya ADMIN dan SUPERVISOR yang dapat melihat daftar pengguna
router.get('/', authorize(Role.ADMIN, Role.SUPERVISOR), getUsers);

// Hanya ADMIN yang dapat menambah, mengedit, dan menghapus staf
router.post('/', authorize(Role.ADMIN), createUser);
router.put('/:id', authorize(Role.ADMIN), updateUser);
router.delete('/:id', authorize(Role.ADMIN), deleteUser);

export default router;
