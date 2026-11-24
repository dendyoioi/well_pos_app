/**
 * Outlet Business Targets Controller
 * Laundry Outlet Performance Intelligence (Well POS) - Wave 2
 * 
 * Menangani penetapan target bisnis bulanan per outlet (Omzet, Laba, Tonase, Transaksi, Pelanggan Baru).
 * Wewenang pengubahan dan penghapusan target DIBATASI KHUSUS UNTUK PERAN OWNER.
 */

import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import {
  resolveEffectiveOutlet,
  analyticsCache,
} from '../services/laundry_analytics/analyticsSecurity.helper';

export async function getOutletTargets(req: Request, res: Response) {
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

    if (req.query.periodYear) {
      const year = parseInt(req.query.periodYear as string);
      if (!isNaN(year)) {
        where.periodYear = year;
      }
    }

    if (req.query.periodMonth) {
      const month = parseInt(req.query.periodMonth as string);
      if (!isNaN(month)) {
        where.periodMonth = month;
      }
    }

    const items = await prisma.outletBusinessTarget.findMany({
      where,
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
      ],
      include: {
        outlet: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, userCode: true } },
      },
    });

    return res.status(200).json({
      status: 'success',
      data: items,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Gagal mengambil data target bisnis outlet',
    });
  }
}

export async function upsertOutletTarget(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    // Hanya OWNER yang diizinkan mengatur target bisnis outlet
    if (user.role !== Role.OWNER) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya peran OWNER yang memiliki wewenang mengatur target bisnis outlet',
      });
    }

    const {
      outletId,
      periodYear,
      periodMonth,
      targetRevenue = 0,
      targetProfit = 0,
      targetWeightKg = 0,
      targetOrdersCount = 0,
      targetNewCustomers = 0,
      notes,
    } = req.body;

    if (!outletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet ID wajib diisi' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId: user.tenantId },
    });
    if (!outlet) {
      return res.status(400).json({ status: 'error', message: 'Outlet tidak ditemukan atau bukan milik tenant Anda' });
    }

    const year = parseInt(periodYear);
    if (isNaN(year) || year < 2020 || year > 2100) {
      return res.status(400).json({ status: 'error', message: 'Tahun target tidak valid (harus antara 2020 - 2100)' });
    }

    const month = parseInt(periodMonth);
    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ status: 'error', message: 'Bulan target tidak valid (harus antara 1 - 12)' });
    }

    const numRevenue = Number(targetRevenue);
    const numProfit = Number(targetProfit);
    const numWeight = Number(targetWeightKg);
    const numOrders = parseInt(targetOrdersCount);
    const numCustomers = parseInt(targetNewCustomers);

    if (numRevenue < 0 || numProfit < 0 || numWeight < 0 || numOrders < 0 || numCustomers < 0) {
      return res.status(400).json({ status: 'error', message: 'Nilai target tidak boleh bernilai negatif' });
    }

    const target = await prisma.outletBusinessTarget.upsert({
      where: {
        tenantId_outletId_periodYear_periodMonth: {
          tenantId: user.tenantId,
          outletId,
          periodYear: year,
          periodMonth: month,
        },
      },
      update: {
        targetRevenue: numRevenue,
        targetProfit: numProfit,
        targetWeightKg: numWeight,
        targetOrdersCount: isNaN(numOrders) ? 0 : numOrders,
        targetNewCustomers: isNaN(numCustomers) ? 0 : numCustomers,
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : undefined,
        createdById: user.id,
      },
      create: {
        tenantId: user.tenantId,
        outletId,
        periodYear: year,
        periodMonth: month,
        targetRevenue: numRevenue,
        targetProfit: numProfit,
        targetWeightKg: numWeight,
        targetOrdersCount: isNaN(numOrders) ? 0 : numOrders,
        targetNewCustomers: isNaN(numCustomers) ? 0 : numCustomers,
        notes: notes ? String(notes).trim() : null,
        createdById: user.id,
      },
      include: {
        outlet: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    analyticsCache.clearTenant(user.tenantId);

    return res.status(200).json({
      status: 'success',
      data: target,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal menyimpan target bisnis outlet',
    });
  }
}

export async function deleteOutletTarget(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    if (user.role !== Role.OWNER) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya peran OWNER yang memiliki wewenang menghapus target bisnis outlet',
      });
    }

    const { id } = req.params;
    const existing = await prisma.outletBusinessTarget.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Target bisnis outlet tidak ditemukan' });
    }

    await prisma.outletBusinessTarget.delete({
      where: { id: existing.id },
    });

    analyticsCache.clearTenant(user.tenantId);

    return res.status(200).json({
      status: 'success',
      message: 'Target bisnis outlet berhasil dihapus',
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal menghapus target bisnis outlet',
    });
  }
}
