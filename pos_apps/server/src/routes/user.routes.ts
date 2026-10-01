import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getRoles,
  getSystemPermissions,
  createRole,
  updateRole,
  deleteRole,
  revokeUserSession,
  revokeAllSessions,
} from '../controllers/user.controller';

const router = Router();

// Semua rute user manajemen memerlukan autentikasi login
router.use(authenticate);

// Pencabutan Sesi Perangkat / Force Logout Kasir (Harus sebelum /:id)
router.post('/revoke-all-sessions', authorize(Role.OWNER, Role.ADMIN), revokeAllSessions);
router.post('/:id/revoke-session', authorize(Role.OWNER, Role.ADMIN), revokeUserSession);

// Role & Permission Management (Harus sebelum /:id)
router.get('/roles/permissions', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), getSystemPermissions);
router.get('/roles', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), getRoles);
router.post('/roles', authorize(Role.OWNER, Role.ADMIN), createRole);
router.put('/roles/:id', authorize(Role.OWNER, Role.ADMIN), updateRole);
router.delete('/roles/:id', authorize(Role.OWNER, Role.ADMIN), deleteRole);

// Hanya OWNER, ADMIN dan SUPERVISOR yang dapat melihat daftar pengguna
router.get('/', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), getUsers);

// Hanya OWNER dan ADMIN yang dapat menambah, mengedit, dan menghapus staf
router.post('/', authorize(Role.OWNER, Role.ADMIN), createUser);
router.put('/:id', authorize(Role.OWNER, Role.ADMIN), updateUser);
router.delete('/:id', authorize(Role.OWNER, Role.ADMIN), deleteUser);

export default router;
