/**
 * Persistent Alerts Controller
 * Laundry Outlet Performance Intelligence (Well POS) - Wave 3A
 * 
 * Mengelola pembacaan daftar alert persisten, evaluasi engine pemicu,
 * pembaruan status resolusi (OPEN -> IN_PROGRESS -> RESOLVED / IGNORED),
 * serta konfigurasi ambang batas alert kanonikal (AlertRuleConfig).
 */

import { Request, Response } from 'express';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import {
  resolveEffectiveOutlet,
  analyticsCache,
} from '../services/laundry_analytics/analyticsSecurity.helper';
import {
  DEFAULT_ALERT_RULES,
  FINANCIAL_ALERT_RULE_KEYS,
  getEffectiveAlertRules,
  evaluateOutletAlerts,
} from '../services/laundry_analytics/alertEvaluationEngine.service';

/**
 * GET /api/laundry/analytics/alerts
 * Mengambil daftar persistent alert dengan filter outlet, status, severity, dan pagination.
 * Supervisor otomatis disaring dari alert berbau finansial.
 */
export async function getPersistentAlerts(req: Request, res: Response) {
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

    // Filter Status ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED', atau 'ALL')
    const statusQuery = req.query.status as string | undefined;
    if (statusQuery && statusQuery.toUpperCase() !== 'ALL') {
      where.status = statusQuery.toUpperCase();
    }

    // Filter Severity ('CRITICAL', 'WARNING', atau 'ALL')
    const severityQuery = req.query.severity as string | undefined;
    if (severityQuery && severityQuery.toUpperCase() !== 'ALL') {
      where.severity = severityQuery.toUpperCase();
    }

    // RBAC Guard: SUPERVISOR tidak boleh melihat alert finansial
    if (user.role === Role.SUPERVISOR) {
      where.ruleKey = { notIn: Array.from(FINANCIAL_ALERT_RULE_KEYS) };
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [totalItems, alerts] = await Promise.all([
      prisma.persistentAlert.count({ where }),
      prisma.persistentAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          outlet: { select: { id: true, name: true } },
          resolvedBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Query Summary Count (untuk badge & filter counter) dengan outlet scoping yang sama
    const summaryWhere: any = { tenantId: user.tenantId };
    if (where.outletId) {
      summaryWhere.outletId = where.outletId;
    }
    if (user.role === Role.SUPERVISOR) {
      summaryWhere.ruleKey = { notIn: Array.from(FINANCIAL_ALERT_RULE_KEYS) };
    }

    const [openCriticalCount, openWarningCount, inProgressCount, resolvedCount] =
      await Promise.all([
        prisma.persistentAlert.count({
          where: { ...summaryWhere, status: 'OPEN', severity: 'CRITICAL' },
        }),
        prisma.persistentAlert.count({
          where: { ...summaryWhere, status: 'OPEN', severity: 'WARNING' },
        }),
        prisma.persistentAlert.count({
          where: { ...summaryWhere, status: 'IN_PROGRESS' },
        }),
        prisma.persistentAlert.count({
          where: { ...summaryWhere, status: 'RESOLVED' },
        }),
      ]);

    const formattedAlerts = alerts.map((a) => ({
      id: a.id,
      tenantId: a.tenantId,
      outletId: a.outletId,
      ruleKey: a.ruleKey,
      severity: a.severity,
      title: a.title,
      message: a.message,
      metricValue: Number(a.metricValue),
      thresholdValue: Number(a.thresholdValue),
      status: a.status,
      waNotifiedAt: a.waNotifiedAt ? a.waNotifiedAt.toISOString() : null,
      resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
      resolvedById: a.resolvedById,
      resolutionNotes: a.resolutionNotes,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      outlet: a.outlet,
      resolvedBy: a.resolvedBy,
    }));

    return res.json({
      status: 'success',
      data: {
        alerts: formattedAlerts,
        summary: {
          openCriticalCount,
          openWarningCount,
          inProgressCount,
          resolvedCount,
          totalOpen: openCriticalCount + openWarningCount,
        },
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit) || 1,
        },
      },
    });
  } catch (err: any) {
    console.error('[GET PERSISTENT ALERTS ERROR]', err);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Gagal mengambil daftar persistent alerts',
    });
  }
}

/**
 * POST /api/laundry/analytics/alerts/evaluate
 * Menjalankan engine evaluasi alert secara manual on-demand (Khusus OWNER & ADMIN).
 */
export async function evaluateAlerts(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const { outletId, preset = 'month', triggerWa = true } = req.body;

    // 1. Jika OWNER mengirim outletId = 'ALL' atau kosong, evaluasi seluruh outlet aktif tenant
    if (user.role === Role.OWNER && (!outletId || outletId === 'ALL')) {
      const activeOutlets = await prisma.outlet.findMany({
        where: { tenantId: user.tenantId, isActive: true },
        select: { id: true },
      });

      if (activeOutlets.length === 0) {
        return res.json({
          status: 'success',
          message: 'Tidak ada outlet aktif yang perlu dievaluasi.',
          data: {
            evaluatedRulesCount: 0,
            createdCount: 0,
            updatedCount: 0,
            waSentCount: 0,
            alerts: [],
          },
        });
      }

      const results = await Promise.all(
        activeOutlets.map((o) =>
          evaluateOutletAlerts({
            tenantId: user.tenantId,
            outletId: o.id,
            preset,
            triggerWa: Boolean(triggerWa),
          })
        )
      );

      const aggregatedResult = results.reduce(
        (acc, r) => ({
          evaluatedRulesCount: acc.evaluatedRulesCount + r.evaluatedRulesCount,
          createdCount: acc.createdCount + r.createdCount,
          updatedCount: acc.updatedCount + r.updatedCount,
          waSentCount: acc.waSentCount + r.waSentCount,
          alerts: [...acc.alerts, ...r.alerts],
        }),
        {
          evaluatedRulesCount: 0,
          createdCount: 0,
          updatedCount: 0,
          waSentCount: 0,
          alerts: [] as any[],
        }
      );

      analyticsCache.clearTenant(user.tenantId);

      return res.json({
        status: 'success',
        message: `Evaluasi alert selesai untuk ${activeOutlets.length} outlet aktif. ${aggregatedResult.createdCount} alert baru dibuat, ${aggregatedResult.updatedCount} alert diperbarui.`,
        data: aggregatedResult,
      });
    }

    // 2. Evaluasi outlet spesifik (atau otomatis terkunci untuk ADMIN)
    const effectiveOutlet = resolveEffectiveOutlet(user, outletId);

    if (effectiveOutlet === 'ALL') {
      return res.status(400).json({
        status: 'error',
        message: 'outletId spesifik wajib diberikan untuk evaluasi alert',
      });
    }

    const result = await evaluateOutletAlerts({
      tenantId: user.tenantId,
      outletId: effectiveOutlet,
      preset,
      triggerWa: Boolean(triggerWa),
    });

    // Invalidate analytics cache
    analyticsCache.clearTenant(user.tenantId);

    return res.json({
      status: 'success',
      message: `Evaluasi alert selesai. ${result.createdCount} alert baru dibuat, ${result.updatedCount} alert diperbarui.`,
      data: result,
    });
  } catch (err: any) {
    console.error('[EVALUATE ALERTS ERROR]', err);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Gagal mengevaluasi persistent alerts',
    });
  }
}

/**
 * PATCH /api/laundry/analytics/alerts/:id/status
 * Memperbarui status alert (OPEN -> IN_PROGRESS -> RESOLVED -> IGNORED).
 * SUPERVISOR dilarang mengubah status alert finansial (HTTP 403).
 */
export async function updateAlertStatus(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const { id } = req.params;
    const { status, resolutionNotes } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Status tidak valid. Pilihan yang diizinkan: ${validStatuses.join(', ')}`,
      });
    }

    const alert = await prisma.persistentAlert.findUnique({
      where: { id },
    });

    if (!alert || alert.tenantId !== user.tenantId) {
      return res.status(404).json({
        status: 'error',
        message: 'Alert tidak ditemukan pada tenant ini',
      });
    }

    // Admin Outlet Scoping
    if (user.role === Role.ADMIN && user.outletId && user.outletId !== alert.outletId) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Admin hanya dapat mengelola alert di outlet yang ditugaskan',
      });
    }

    // Supervisor Scoping & Financial Block
    if (user.role === Role.SUPERVISOR) {
      if (user.outletId && user.outletId !== alert.outletId) {
        return res.status(403).json({
          status: 'error',
          message: 'Akses ditolak: Supervisor hanya dapat mengelola alert di outlet yang ditugaskan',
        });
      }
      if ((FINANCIAL_ALERT_RULE_KEYS as readonly string[]).includes(alert.ruleKey)) {
        return res.status(403).json({
          status: 'error',
          message: 'Akses ditolak: Supervisor tidak diizinkan mengubah status alert finansial',
        });
      }
    }

    const isResolvedOrIgnored = status === 'RESOLVED' || status === 'IGNORED';

    const updated = await prisma.persistentAlert.update({
      where: { id },
      data: {
        status,
        resolvedAt: isResolvedOrIgnored ? new Date() : null,
        resolvedById: isResolvedOrIgnored ? user.id : null,
        resolutionNotes:
          resolutionNotes !== undefined ? resolutionNotes : isResolvedOrIgnored ? alert.resolutionNotes : null,
      },
      include: {
        outlet: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    analyticsCache.clearTenant(user.tenantId);

    return res.json({
      status: 'success',
      message: `Status alert berhasil diperbarui menjadi ${status}`,
      data: {
        ...updated,
        metricValue: Number(updated.metricValue),
        thresholdValue: Number(updated.thresholdValue),
      },
    });
  } catch (err: any) {
    console.error('[UPDATE ALERT STATUS ERROR]', err);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal memperbarui status alert',
    });
  }
}

/**
 * GET /api/laundry/analytics/alert-rules
 * Mengambil daftar 10 aturan alert efektif untuk tenant / outlet tertentu (OWNER & ADMIN).
 */
export async function getAlertRules(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutlet = resolveEffectiveOutlet(user, requestedOutletId);

    const targetOutlet =
      effectiveOutlet !== 'ALL'
        ? effectiveOutlet
        : requestedOutletId && requestedOutletId !== 'ALL'
        ? requestedOutletId
        : null;

    const rules = await getEffectiveAlertRules(user.tenantId, targetOutlet);

    return res.json({
      status: 'success',
      data: rules,
    });
  } catch (err: any) {
    console.error('[GET ALERT RULES ERROR]', err);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Gagal mengambil konfigurasi aturan alert',
    });
  }
}

/**
 * PUT /api/laundry/analytics/alert-rules
 * Mengubah ambang batas atau kanal notifikasi suatu aturan alert (Khusus OWNER).
 * Menangani partial unique index PostgreSQL secara aman (outletId: null vs specific outletId).
 */
export async function upsertAlertRule(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant ID tidak valid' });
    }

    const {
      outletId,
      ruleKey,
      warningThreshold,
      criticalThreshold,
      isEnabled = true,
      notificationChannels = ['IN_APP'],
    } = req.body;

    // Validasi ruleKey
    const isValidRuleKey = DEFAULT_ALERT_RULES.some((r) => r.ruleKey === ruleKey);
    if (!ruleKey || !isValidRuleKey) {
      return res.status(400).json({
        status: 'error',
        message: `ruleKey tidak valid. Pilihan kanonikal: ${DEFAULT_ALERT_RULES.map((r) => r.ruleKey).join(', ')}`,
      });
    }

    // Validasi Angka Threshold
    const warnNum = Number(warningThreshold);
    const critNum = Number(criticalThreshold);
    if (isNaN(warnNum) || isNaN(critNum)) {
      return res.status(400).json({
        status: 'error',
        message: 'warningThreshold dan criticalThreshold wajib berupa angka numerik valid',
      });
    }

    // Validasi Notification Channels
    const channels = Array.isArray(notificationChannels)
      ? notificationChannels.filter((c: any) => typeof c === 'string')
      : ['IN_APP'];

    const effectiveOutletId =
      outletId && outletId !== 'ALL' && outletId !== '' ? outletId : null;

    // Jika menargetkan outlet spesifik, pastikan outlet tersebut ada pada tenant
    if (effectiveOutletId) {
      const outletExists = await prisma.outlet.findFirst({
        where: { id: effectiveOutletId, tenantId: user.tenantId },
      });
      if (!outletExists) {
        return res.status(404).json({
          status: 'error',
          message: 'Outlet tidak ditemukan pada tenant ini',
        });
      }
    }

    // PENTING: PostgreSQL Partial Unique Index Handling
    // Prisma .upsert() gagal pada compound unique jika salah satu kolom bernilai NULL
    // Maka gunakan pola: findFirst -> update / create
    let savedRule: any;

    const existingConfig = await prisma.alertRuleConfig.findFirst({
      where: {
        tenantId: user.tenantId,
        outletId: effectiveOutletId,
        ruleKey,
      },
    });

    if (existingConfig) {
      savedRule = await prisma.alertRuleConfig.update({
        where: { id: existingConfig.id },
        data: {
          warningThreshold: new Prisma.Decimal(warnNum),
          criticalThreshold: new Prisma.Decimal(critNum),
          isEnabled: Boolean(isEnabled),
          notificationChannels: channels,
        },
      });
    } else {
      savedRule = await prisma.alertRuleConfig.create({
        data: {
          tenantId: user.tenantId,
          outletId: effectiveOutletId,
          ruleKey,
          warningThreshold: new Prisma.Decimal(warnNum),
          criticalThreshold: new Prisma.Decimal(critNum),
          isEnabled: Boolean(isEnabled),
          notificationChannels: channels,
        },
      });
    }

    analyticsCache.clearTenant(user.tenantId);

    return res.json({
      status: 'success',
      message: `Konfigurasi aturan alert ${ruleKey} berhasil disimpan`,
      data: {
        ...savedRule,
        warningThreshold: Number(savedRule.warningThreshold),
        criticalThreshold: Number(savedRule.criticalThreshold),
      },
    });
  } catch (err: any) {
    console.error('[UPSERT ALERT RULE ERROR]', err);
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Gagal menyimpan konfigurasi aturan alert',
    });
  }
}
