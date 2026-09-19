import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AuthUserPayload } from '../types/auth';

interface JwtPayloadDecoded {
  userId: string;
  role: Role;
  outletId: string | null;
}

/**
 * Middleware untuk memverifikasi JWT token di header Authorization (Bearer <token>)
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak: Token otentikasi tidak ditemukan',
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'rahasia_super_aman_pos_12345';

    let decoded: JwtPayloadDecoded;
    try {
      decoded = jwt.verify(token, secret) as JwtPayloadDecoded;
    } catch {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak: Token tidak valid atau telah kadaluarsa',
      });
    }

    // Pastikan user masih aktif di database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        outletId: true,
        tenantId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'Akun pengguna tidak aktif atau tidak ditemukan',
      });
    }

    // Lampirkan payload user ke objek request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      outletId: user.outletId,
      tenantId: user.tenantId,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat memverifikasi otentikasi',
    });
  }
};

/**
 * Middleware RBAC (Role-Based Access Control)
 * Membatasi akses endpoint hanya untuk role tertentu (misal: ADMIN, SUPERVISOR)
 */
export const authorize = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Pengguna belum terautentikasi',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Akses dilarang: Role '${req.user.role}' tidak memiliki izin untuk tindakan ini`,
      });
    }

    next();
  };
};
