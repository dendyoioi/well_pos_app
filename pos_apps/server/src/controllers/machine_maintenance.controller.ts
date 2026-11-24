/**
 * Machine Maintenance Controller
 * Laundry Outlet Performance Intelligence (Well POS) - Wave 2
 * 
 * Menangani pencatatan riwayat servis & perbaikan mesin cuci/pengering,
 * sinkronisasi status mesin laundry secara atomik (ACTIVE <-> MAINTENANCE),
 * kalkulasi otomatis durasi downtime, serta proteksi sensor biaya untuk SUPERVISOR.
 */

import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import {
  resolveEffectiveOutlet,
  sanitizeAnalyticsPayloadForRole,
  analyticsCache,
} from '../services/laundry_analytics/analyticsSecurity.helper';

export async function getMachineMaintenanceLogs(req: Request, res: Response) {
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

    if (req.query.machineId) {
      where.machineId = req.query.machineId as string;
    }

    if (req.query.status) {
      where.status = req.query.status as string;
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const totalItems = await prisma.laundryMachineMaintenanceLog.count({ where });

    const items = await prisma.laundryMachineMaintenanceLog.findMany({
      where,
      orderBy: { startDate: 'desc' },
      skip,
      take: limit,
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            code: true,
            machineType: true,
            status: true,
          },
        },
        outlet: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, userCode: true } },
      },
    });

    const resultPayload = {
      items,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };

    // Sensor field finansial (cost) jika peran adalah SUPERVISOR
    const sanitized = sanitizeAnalyticsPayloadForRole(resultPayload, user.role);

    return res.status(200).json({
      status: 'success',
      data: sanitized,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Gagal mengambil data log perbaikan mesin',
    });
  }
}

export async function createMachineMaintenanceLog(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const {
      machineId,
      serviceType = 'ROUTINE',
      startDate,
      endDate,
      downtimeMinutes,
      technicianName,
      cost = 0,
      notes,
      status = 'SCHEDULED',
    } = req.body;

    if (!machineId) {
      return res.status(400).json({ status: 'error', message: 'ID Mesin laundry wajib diisi' });
    }

    const machine = await prisma.laundryMachine.findFirst({
      where: { id: machineId, tenantId: user.tenantId },
    });
    if (!machine) {
      return res.status(400).json({ status: 'error', message: 'Mesin laundry tidak ditemukan atau bukan milik tenant Anda' });
    }

    // Validasi outlet scoping jika user terkunci pada outlet tertentu
    if ((user.role === Role.ADMIN || user.role === Role.SUPERVISOR) && user.outletId && machine.outletId !== user.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Anda tidak memiliki izin mencatat servis untuk outlet mesin ini',
      });
    }

    const start = new Date(startDate || Date.now());
    if (isNaN(start.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Waktu mulai servis tidak valid' });
    }

    const end = endDate ? new Date(endDate) : null;
    if (end && isNaN(end.getTime())) {
      return res.status(400).json({ status: 'error', message: 'Waktu selesai servis tidak valid' });
    }

    // Hitung downtime otomatis jika endDate diisi dan downtimeMinutes tidak dikirim/0
    let downtime = downtimeMinutes !== undefined && downtimeMinutes !== null ? parseInt(downtimeMinutes) : 0;
    if ((!downtime || downtime <= 0) && end && !isNaN(end.getTime()) && !isNaN(start.getTime())) {
      downtime = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    }

    // Role SUPERVISOR tidak boleh input biaya finansial servis (paksa 0)
    let parsedCost = Number(cost || 0);
    if (user.role === Role.SUPERVISOR) {
      parsedCost = 0;
    } else if (isNaN(parsedCost) || parsedCost < 0) {
      parsedCost = 0;
    }

    // Eksekusi atomik menggunakan Prisma transaction
    const createdLog = await prisma.$transaction(async (tx) => {
      const log = await tx.laundryMachineMaintenanceLog.create({
        data: {
          tenantId: user.tenantId,
          outletId: machine.outletId,
          machineId: machine.id,
          serviceType: serviceType || 'ROUTINE',
          startDate: start,
          endDate: end,
          downtimeMinutes: isNaN(downtime) ? 0 : downtime,
          technicianName: technicianName ? String(technicianName).trim() : null,
          cost: parsedCost,
          notes: notes ? String(notes).trim() : null,
          status: status || 'SCHEDULED',
          createdById: user.id,
        },
        include: {
          machine: {
            select: {
              id: true,
              name: true,
              code: true,
              machineType: true,
              status: true,
            },
          },
          outlet: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      // SINKRONISASI STATUS MESIN ATOMIK:
      // 1. Jika status log menjadi IN_PROGRESS -> ubah mesin jadi MAINTENANCE
      if (log.status === 'IN_PROGRESS') {
        await tx.laundryMachine.update({
          where: { id: machine.id },
          data: { status: 'MAINTENANCE' },
        });
      }
      // 2. Jika status log diselesaikan (COMPLETED atau CANCELLED) -> periksa apakah ada log IN_PROGRESS lain
      else if (log.status === 'COMPLETED' || log.status === 'CANCELLED') {
        const otherInProgress = await tx.laundryMachineMaintenanceLog.findFirst({
          where: {
            machineId: machine.id,
            status: 'IN_PROGRESS',
            id: { not: log.id },
          },
        });
        if (!otherInProgress && machine.status === 'MAINTENANCE') {
          await tx.laundryMachine.update({
            where: { id: machine.id },
            data: { status: 'ACTIVE' },
          });
        }
      }

      return log;
    });

    analyticsCache.clearTenant(user.tenantId);

    const sanitized = sanitizeAnalyticsPayloadForRole(createdLog, user.role);

    return res.status(201).json({
      status: 'success',
      data: sanitized,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal membuat log perbaikan mesin',
    });
  }
}

export async function updateMachineMaintenanceLog(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const { id } = req.params;
    const existing = await prisma.laundryMachineMaintenanceLog.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { machine: true },
    });

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Log perbaikan mesin tidak ditemukan' });
    }

    if ((user.role === Role.ADMIN || user.role === Role.SUPERVISOR) && user.outletId && existing.outletId !== user.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Anda tidak memiliki izin memperbarui data outlet lain',
      });
    }

    const {
      status,
      serviceType,
      startDate,
      endDate,
      downtimeMinutes,
      technicianName,
      cost,
      notes,
    } = req.body;

    const start = startDate ? new Date(startDate) : existing.startDate;
    const end = endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate;

    let downtime = downtimeMinutes !== undefined ? parseInt(downtimeMinutes) : existing.downtimeMinutes;
    if ((downtimeMinutes === undefined || downtime <= 0) && end && !isNaN(end.getTime()) && !isNaN(start.getTime())) {
      downtime = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    }

    let parsedCost = existing.cost;
    // Supervisor dilarang mengubah biaya
    if (user.role !== Role.SUPERVISOR && cost !== undefined) {
      const num = Number(cost);
      if (!isNaN(num) && num >= 0) {
        parsedCost = num as any;
      }
    }

    const targetStatus = status || existing.status;

    const updatedLog = await prisma.$transaction(async (tx) => {
      const updated = await tx.laundryMachineMaintenanceLog.update({
        where: { id: existing.id },
        data: {
          status: targetStatus,
          serviceType: serviceType || existing.serviceType,
          startDate: start,
          endDate: end,
          downtimeMinutes: isNaN(downtime) ? 0 : downtime,
          technicianName: technicianName !== undefined ? (technicianName ? String(technicianName).trim() : null) : existing.technicianName,
          cost: parsedCost,
          notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
        },
        include: {
          machine: {
            select: {
              id: true,
              name: true,
              code: true,
              machineType: true,
              status: true,
            },
          },
          outlet: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      // Sinkronisasi status mesin laundry
      if (updated.status === 'IN_PROGRESS') {
        await tx.laundryMachine.update({
          where: { id: existing.machineId },
          data: { status: 'MAINTENANCE' },
        });
      } else if (updated.status === 'COMPLETED' || updated.status === 'CANCELLED') {
        const otherInProgress = await tx.laundryMachineMaintenanceLog.findFirst({
          where: {
            machineId: existing.machineId,
            status: 'IN_PROGRESS',
            id: { not: updated.id },
          },
        });
        const currentMachine = await tx.laundryMachine.findUnique({
          where: { id: existing.machineId },
          select: { status: true },
        });
        if (!otherInProgress && currentMachine?.status === 'MAINTENANCE') {
          await tx.laundryMachine.update({
            where: { id: existing.machineId },
            data: { status: 'ACTIVE' },
          });
        }
      }

      return updated;
    });

    analyticsCache.clearTenant(user.tenantId);

    const sanitized = sanitizeAnalyticsPayloadForRole(updatedLog, user.role);

    return res.status(200).json({
      status: 'success',
      data: sanitized,
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal memperbarui log perbaikan mesin',
    });
  }
}

export async function deleteMachineMaintenanceLog(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const { id } = req.params;
    const existing = await prisma.laundryMachineMaintenanceLog.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Log perbaikan mesin tidak ditemukan' });
    }

    if (user.role === Role.ADMIN && user.outletId && existing.outletId !== user.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Admin tidak memiliki izin menghapus data outlet lain',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.laundryMachineMaintenanceLog.delete({
        where: { id: existing.id },
      });

      // Cek apakah mesin masih memiliki log IN_PROGRESS lain
      const otherInProgress = await tx.laundryMachineMaintenanceLog.findFirst({
        where: {
          machineId: existing.machineId,
          status: 'IN_PROGRESS',
        },
      });

      const currentMachine = await tx.laundryMachine.findUnique({
        where: { id: existing.machineId },
        select: { status: true },
      });

      if (!otherInProgress && currentMachine?.status === 'MAINTENANCE') {
        await tx.laundryMachine.update({
          where: { id: existing.machineId },
          data: { status: 'ACTIVE' },
        });
      }
    });

    analyticsCache.clearTenant(user.tenantId);

    return res.status(200).json({
      status: 'success',
      message: 'Log perbaikan mesin berhasil dihapus',
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal menghapus log perbaikan mesin',
    });
  }
}
