/**
 * Operational Expenses Controller
 * Laundry Outlet Performance Intelligence (Well POS) - Wave 2
 * 
 * Menangani pencatatan, pembaruan, dan pelaporan biaya operasional toko/outlet
 * (Listrik, Air, Sewa, Gaji Pokok, Pemasaran, Perawatan, Perlengkapan, dan Lain-lain).
 */

import { Request, Response } from 'express';
import { ExpenseCategory, PaymentMethod, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import {
  resolveEffectiveOutlet,
  analyticsCache,
} from '../services/laundry_analytics/analyticsSecurity.helper';

export async function getOperationalExpenses(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutlet = resolveEffectiveOutlet(user, requestedOutletId);

    const where: any = { tenantId: user.tenantId };

    if (effectiveOutlet !== 'ALL') {
      where.outletId = effectiveOutlet;
    } else if (requestedOutletId && requestedOutletId !== 'ALL') {
      where.outletId = requestedOutletId;
    }

    // Filter Kategori
    if (req.query.category && typeof req.query.category === 'string') {
      const cat = req.query.category.toUpperCase();
      if (Object.values(ExpenseCategory).includes(cat as ExpenseCategory)) {
        where.category = cat as ExpenseCategory;
      }
    }

    // Filter Rentang Tanggal
    if (req.query.startDate || req.query.endDate) {
      where.expenseDate = {};
      if (req.query.startDate) {
        where.expenseDate.gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate as string);
        end.setHours(23, 59, 59, 999);
        where.expenseDate.lte = end;
      }
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Hitung total nominal untuk periode filter
    const aggregate = await prisma.operationalExpense.aggregate({
      _sum: { amount: true },
      where,
    });
    const totalAmount = Number(aggregate._sum.amount || 0);

    const totalItems = await prisma.operationalExpense.count({ where });

    const items = await prisma.operationalExpense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      skip,
      take: limit,
      include: {
        outlet: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, userCode: true } },
      },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        items,
        totalAmount,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      },
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Gagal mengambil data biaya operasional',
    });
  }
}

export async function createOperationalExpense(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const {
      outletId,
      category,
      amount,
      expenseDate,
      paymentMethod = 'CASH',
      notes,
      receiptPhotoUrl,
    } = req.body;

    if (!outletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet ID wajib diisi' });
    }

    // Validasi outlet scoping untuk branch-restricted admin
    if (user.role === Role.ADMIN && user.outletId && outletId !== user.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Admin hanya dapat mencatat pengeluaran untuk outlet yang ditugaskan',
      });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: user.tenantId },
    });
    if (!outlet) {
      return res.status(400).json({ status: 'error', message: 'Outlet tidak ditemukan atau bukan milik tenant Anda' });
    }

    if (!category || !Object.values(ExpenseCategory).includes(category as ExpenseCategory)) {
      return res.status(400).json({
        status: 'error',
        message: `Kategori tidak valid. Pilih salah satu dari: ${Object.values(ExpenseCategory).join(', ')}`,
      });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ status: 'error', message: 'Nominal pengeluaran harus berupa angka lebih besar dari 0' });
    }

    const date = new Date(expenseDate || Date.now());
    if (isNaN(date.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Format tanggal pengeluaran tidak valid' });
    }

    const newExpense = await prisma.operationalExpense.create({
      data: {
        tenantId: user.tenantId,
        outletId,
        expenseDate: date,
        category: category as ExpenseCategory,
        amount: parsedAmount,
        paymentMethod: (paymentMethod as PaymentMethod) || 'CASH',
        notes: notes ? String(notes).trim() : null,
        receiptPhotoUrl: receiptPhotoUrl ? String(receiptPhotoUrl).trim() : null,
        createdById: user.id,
      },
      include: {
        outlet: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    analyticsCache.clearTenant(user.tenantId);

    return res.status(201).json({
      status: 'success',
      data: newExpense,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal membuat biaya operasional',
    });
  }
}

export async function updateOperationalExpense(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const { id } = req.params;
    const existing = await prisma.operationalExpense.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Biaya operasional tidak ditemukan' });
    }

    // Validasi outlet scoping jika admin branch-restricted
    if (user.role === Role.ADMIN && user.outletId && existing.outletId !== user.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Admin tidak memiliki izin mengubah data outlet lain',
      });
    }

    const {
      outletId,
      category,
      amount,
      expenseDate,
      paymentMethod,
      notes,
      receiptPhotoUrl,
    } = req.body;

    let targetOutletId = existing.outletId;
    if (outletId && outletId !== existing.outletId) {
      if (user.role === Role.ADMIN && user.outletId && outletId !== user.outletId) {
        return res.status(403).json({
          status: 'error',
          message: 'Akses ditolak: Admin hanya dapat menetapkan pengeluaran ke outlet yang ditugaskan',
        });
      }
      const outlet = await prisma.outlet.findFirst({
        where: { id: outletId, tenantId: user.tenantId },
      });
      if (!outlet) {
        return res.status(400).json({ status: 'error', message: 'Outlet tujuan tidak ditemukan' });
      }
      targetOutletId = outletId;
    }

    let parsedCategory = existing.category;
    if (category) {
      if (!Object.values(ExpenseCategory).includes(category as ExpenseCategory)) {
        return res.status(400).json({ status: 'error', message: 'Kategori pengeluaran tidak valid' });
      }
      parsedCategory = category as ExpenseCategory;
    }

    let parsedAmount = existing.amount;
    if (amount !== undefined) {
      const num = Number(amount);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({ status: 'error', message: 'Nominal pengeluaran harus lebih besar dari 0' });
      }
      parsedAmount = num as any;
    }

    let parsedDate = existing.expenseDate;
    if (expenseDate) {
      const d = new Date(expenseDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Format tanggal pengeluaran tidak valid' });
      }
      parsedDate = d;
    }

    const updated = await prisma.operationalExpense.update({
      where: { id: existing.id },
      data: {
        outletId: targetOutletId,
        category: parsedCategory,
        amount: parsedAmount,
        expenseDate: parsedDate,
        paymentMethod: paymentMethod ? (paymentMethod as PaymentMethod) : existing.paymentMethod,
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
        receiptPhotoUrl: receiptPhotoUrl !== undefined ? (receiptPhotoUrl ? String(receiptPhotoUrl).trim() : null) : existing.receiptPhotoUrl,
      },
      include: {
        outlet: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    analyticsCache.clearTenant(user.tenantId);

    return res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal memperbarui biaya operasional',
    });
  }
}

export async function deleteOperationalExpense(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const { id } = req.params;
    const existing = await prisma.operationalExpense.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Biaya operasional tidak ditemukan' });
    }

    if (user.role === Role.ADMIN && user.outletId && existing.outletId !== user.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Admin tidak memiliki izin menghapus data outlet lain',
      });
    }

    await prisma.operationalExpense.delete({
      where: { id: existing.id },
    });

    analyticsCache.clearTenant(user.tenantId);

    return res.status(200).json({
      status: 'success',
      message: 'Biaya operasional berhasil dihapus',
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal menghapus biaya operasional',
    });
  }
}
