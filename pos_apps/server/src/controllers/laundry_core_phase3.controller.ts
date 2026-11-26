import { Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { Role } from '@prisma/client';
import {
  getEffectiveAutomationRules,
  dispatchDomainEvent,
  retryDispatchLog,
  CanonicalEventKey,
  NotificationChannel,
} from '../services/notification_automation.service';

const JWT_SECRET = process.env.JWT_SECRET || 'wellpos-default-jwt-secret';

function normalizePhoneNumber(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return digits ? `+${digits}` : '';
}

function getPhoneVariants(phone: string): string[] {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return [];
  const digits = norm.replace(/\D/g, '');
  const zero = '0' + digits.slice(2);
  return Array.from(new Set([norm, digits, zero, phone.trim()]));
}

// ============================================================================
// A. PUBLIC CUSTOMER SELF-SERVICE PORTAL CONTROLLERS
// ============================================================================

export const getPortalOutletInfo = async (req: Request, res: Response) => {
  try {
    const { outletId } = req.params;

    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        isWorkshop: true,
        laundryDeliveryConfig: true,
        tenantId: true,
      },
    });

    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet laundry tidak ditemukan' });
    }

    const services = await prisma.laundryService.findMany({
      where: { tenantId: outlet.tenantId, isActive: true },
      include: {
        outletPrices: {
          where: { outletId: outlet.id },
        },
      },
      orderBy: { name: 'asc' },
    });

    const mappedServices = services.map((s) => {
      const override = s.outletPrices[0];
      const effectivePrice =
        override && override.priceOverride !== null
          ? Number(override.priceOverride)
          : Number(s.price);
      return {
        id: s.id,
        name: s.name,
        category: s.category,
        unit: s.unit,
        durationHours: s.durationHours,
        price: effectivePrice,
        description: s.description,
        minOrderQty: s.minOrderQty,
      };
    });

    return res.json({
      status: 'success',
      data: {
        outlet: {
          id: outlet.id,
          name: outlet.name,
          address: outlet.address,
          phone: outlet.phone,
          deliveryConfig: outlet.laundryDeliveryConfig,
        },
        services: mappedServices,
      },
    });
  } catch (error: any) {
    console.error('Error in getPortalOutletInfo:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil informasi outlet portal' });
  }
};

const createSessionSchema = z.object({
  outletId: z.string().uuid('Outlet ID tidak valid'),
  phone: z.string().min(5, 'Nomor HP minimal 5 karakter').max(30),
});

export const createPortalSession = async (req: Request, res: Response) => {
  try {
    const parseResult = createSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input sesi portal gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, phone } = parseResult.data;
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: { id: true, name: true, tenantId: true },
    });

    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    const phoneVariants = getPhoneVariants(phone);
    const normalized = normalizePhoneNumber(phone);

    // Cari customer berdasarkan varian nomor telepon
    const customer = await prisma.customer.findFirst({
      where: {
        tenantId: outlet.tenantId,
        OR: [
          { phone: { in: phoneVariants } },
          { secondaryPhones: { array_contains: normalized } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        loyaltyPoints: true,
        tier: true,
        laundryPreferences: true,
      },
    });

    if (customer) {
      const token = jwt.sign(
        {
          type: 'CUSTOMER_PORTAL',
          customerId: customer.id,
          tenantId: outlet.tenantId,
          outletId: outlet.id,
          phone: customer.phone || normalized,
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        status: 'success',
        data: {
          isNewCustomer: false,
          token,
          customer,
        },
      });
    }

    // New / Guest customer session
    const guestToken = jwt.sign(
      {
        type: 'CUSTOMER_PORTAL',
        customerId: null,
        tenantId: outlet.tenantId,
        outletId: outlet.id,
        phone: normalized,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      status: 'success',
      data: {
        isNewCustomer: true,
        token: guestToken,
        phone: normalized,
      },
    });
  } catch (error: any) {
    console.error('Error in createPortalSession:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat sesi portal pelanggan' });
  }
};

export const getPortalCustomerMe = async (req: Request, res: Response) => {
  try {
    const portalUser = (req as any).portalUser;
    const { tenantId, outletId, customerId, phone } = portalUser;

    let customerProfile = null;
    let walletInfo = null;

    if (customerId) {
      customerProfile = await prisma.customer.findFirst({
        where: { id: customerId, tenantId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          loyaltyPoints: true,
          tier: true,
          laundryPreferences: true,
        },
      });

      const wallet = await prisma.customerLaundryWallet.findUnique({
        where: { customerId },
      });

      if (wallet) {
        walletInfo = {
          balanceAmount: Number(wallet.balanceAmount),
          quotaKg: Number(wallet.quotaKg),
          quotaExpiresAt: wallet.quotaExpiresAt,
          balanceExpiresAt: wallet.balanceExpiresAt,
        };
      }
    }

    const phoneVariants = getPhoneVariants(phone);

    // Ambil order aktif dan riwayat order terakhir (maks 20)
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        OR: [
          ...(customerId ? [{ customerId }] : []),
          { customer: { phone: { in: phoneVariants } } },
        ],
      },
      include: {
        laundryDetail: {
          select: {
            currentStage: true,
            status: true,
            totalWeightKg: true,
            totalPieces: true,
            rackCode: true,
            estimatedReadyAt: true,
            deliveryType: true,
            deliveryStatus: true,
            qcStatus: true,
          },
        },
        items: {
          select: {
            productName: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const activeOrders = orders.filter(
      (o) => o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'VOIDED'
    );
    const recentOrders = orders.filter(
      (o) => o.orderStatus === 'COMPLETED' || o.orderStatus === 'CANCELLED'
    );

    // Ambil permintaan jemput terakhir (maks 10)
    const pickupRequests = await prisma.laundryPickupRequest.findMany({
      where: {
        tenantId,
        OR: [
          ...(customerId ? [{ customerId }] : []),
          { customerPhone: { in: phoneVariants } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return res.json({
      status: 'success',
      data: {
        customer: customerProfile,
        wallet: walletInfo,
        activeOrders,
        recentOrders,
        pickupRequests,
      },
    });
  } catch (error: any) {
    console.error('Error in getPortalCustomerMe:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil data akun portal pelanggan' });
  }
};

const createPickupRequestSchema = z.object({
  customerName: z.string().min(1, 'Nama pemesan wajib diisi').max(100),
  customerPhone: z.string().min(5, 'Nomor HP wajib diisi').max(30).optional(),
  pickupAddress: z.string().min(5, 'Alamat penjemputan wajib diisi').max(1000),
  pickupNotes: z.string().max(500).optional().nullable(),
  preferredPickupAt: z.string().optional().nullable(),
  estimatedWeightKg: z.number().positive().optional().nullable(),
  serviceCategory: z.enum(['KILOAN', 'SATUAN', 'EXPRESS', 'SEPATU_TAS']).optional().nullable(),
});

export const createPortalPickupRequest = async (req: Request, res: Response) => {
  try {
    const portalUser = (req as any).portalUser;
    const { tenantId, outletId, customerId, phone: sessionPhone } = portalUser;

    const parseResult = createPickupRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi permintaan jemput gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const {
      customerName,
      customerPhone,
      pickupAddress,
      pickupNotes,
      preferredPickupAt,
      estimatedWeightKg,
      serviceCategory,
    } = parseResult.data;

    const finalPhone = normalizePhoneNumber(customerPhone || sessionPhone);
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randSeq = Math.floor(100 + Math.random() * 900);
    const requestCode = `PKP-${dateStr}-${randSeq}`;

    const pickupRequest = await prisma.laundryPickupRequest.create({
      data: {
        tenantId,
        outletId,
        customerId: customerId || null,
        requestCode,
        customerName: customerName.trim(),
        customerPhone: finalPhone,
        pickupAddress: pickupAddress.trim(),
        pickupNotes: pickupNotes?.trim() || null,
        preferredPickupAt: preferredPickupAt ? new Date(preferredPickupAt) : null,
        estimatedWeightKg: estimatedWeightKg !== undefined && estimatedWeightKg !== null ? estimatedWeightKg : null,
        serviceCategory: serviceCategory || 'KILOAN',
        status: 'PENDING',
      },
    });

    return res.status(201).json({
      status: 'success',
      data: pickupRequest,
      message: 'Permintaan jemput cucian berhasil dikirim!',
    });
  } catch (error: any) {
    console.error('Error in createPortalPickupRequest:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal membuat permintaan jemput cucian' });
  }
};

// ============================================================================
// B. DRIVER ASSIGNMENT BOARD & FAILED ATTEMPT HANDLING
// ============================================================================

export const getPickupRequests = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    let targetOutletId = (req.query.outletId as string) || undefined;
    if (!isPrivileged && user.outletId) {
      targetOutletId = user.outletId;
    }

    const requests = await prisma.laundryPickupRequest.findMany({
      where: {
        tenantId: user.tenantId,
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
        ...(req.query.status ? { status: req.query.status as string } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedDriver: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ status: 'success', data: requests });
  } catch (error: any) {
    console.error('Error in getPickupRequests:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil daftar permintaan jemput' });
  }
};

const assignPickupSchema = z.object({
  courierName: z.string().min(1).max(100).optional().nullable(),
  courierPhone: z.string().max(30).optional().nullable(),
  assignedDriverId: z.string().uuid().optional().nullable(),
  routeOrder: z.number().int().optional().nullable(),
  status: z.enum(['CONFIRMED', 'DRIVER_ASSIGNED', 'PICKED_UP', 'CANCELLED']).optional(),
});

export const assignPickupRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const parseResult = assignPickupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi penugasan kurir gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const pickupReq = await prisma.laundryPickupRequest.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { outlet: true },
    });

    if (!pickupReq) {
      return res.status(404).json({ status: 'error', message: 'Permintaan jemput tidak ditemukan' });
    }

    const { courierName, courierPhone, assignedDriverId, routeOrder, status } = parseResult.data;
    const nextStatus = status || (courierName || assignedDriverId ? 'DRIVER_ASSIGNED' : 'CONFIRMED');

    const updated = await prisma.laundryPickupRequest.update({
      where: { id: pickupReq.id },
      data: {
        courierName: courierName !== undefined ? courierName : pickupReq.courierName,
        courierPhone: courierPhone !== undefined ? courierPhone : pickupReq.courierPhone,
        assignedDriverId: assignedDriverId !== undefined ? assignedDriverId : pickupReq.assignedDriverId,
        routeOrder: routeOrder !== undefined ? routeOrder : pickupReq.routeOrder,
        status: nextStatus,
        pickedUpAt: nextStatus === 'PICKED_UP' ? new Date() : pickupReq.pickedUpAt,
      },
    });

    // Otomatis kirim notifikasi konfirmasi penjemputan jika status CONFIRMED atau DRIVER_ASSIGNED
    if (nextStatus === 'CONFIRMED' || nextStatus === 'DRIVER_ASSIGNED') {
      try {
        await dispatchDomainEvent({
          tenantId: user.tenantId,
          outletId: pickupReq.outletId,
          eventKey: 'PICKUP_REQUEST_CONFIRMED',
          recipient: {
            name: pickupReq.customerName,
            phone: pickupReq.customerPhone,
          },
          reference: {
            type: 'PICKUP_REQUEST',
            id: pickupReq.id,
          },
          variables: {
            customerName: pickupReq.customerName,
            requestCode: pickupReq.requestCode,
            outletName: pickupReq.outlet?.name || 'Laundry Kami',
            courierName: updated.courierName || 'Kurir Outlet',
            courierPhone: updated.courierPhone || '-',
          },
        });
      } catch (notifErr) {
        console.error('Failed to dispatch PICKUP_REQUEST_CONFIRMED:', notifErr);
      }
    }

    return res.json({ status: 'success', data: updated });
  } catch (error: any) {
    console.error('Error in assignPickupRequest:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui penugasan kurir' });
  }
};

const markPickupFailedSchema = z.object({
  reason: z.string().min(3, 'Alasan kegagalan minimal 3 karakter').max(500),
  rescheduledAt: z.string().optional().nullable(),
});

export const markPickupFailedAttempt = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const parseResult = markPickupFailedSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi catatan gagal jemput tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { reason, rescheduledAt } = parseResult.data;

    const pickupReq = await prisma.laundryPickupRequest.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { outlet: true },
    });

    if (!pickupReq) {
      return res.status(404).json({ status: 'error', message: 'Permintaan jemput tidak ditemukan' });
    }

    const updated = await prisma.laundryPickupRequest.update({
      where: { id: pickupReq.id },
      data: {
        status: 'FAILED_ATTEMPT',
        attemptCount: { increment: 1 },
        lastFailureReason: reason.trim(),
        rescheduledAt: rescheduledAt ? new Date(rescheduledAt) : null,
      },
    });

    // Otomatis trigger notifikasi DELIVERY_FAILED ke pelanggan
    try {
      await dispatchDomainEvent({
        tenantId: user.tenantId,
        outletId: pickupReq.outletId,
        eventKey: 'DELIVERY_FAILED',
        recipient: {
          name: pickupReq.customerName,
          phone: pickupReq.customerPhone,
        },
        reference: {
          type: 'PICKUP_REQUEST',
          id: pickupReq.id,
        },
        variables: {
          customerName: pickupReq.customerName,
          referenceCode: pickupReq.requestCode,
          outletName: pickupReq.outlet?.name || 'Laundry Kami',
          reason: reason.trim(),
          rescheduledAt: rescheduledAt ? new Date(rescheduledAt).toLocaleString('id-ID') : 'Segera dikonfirmasi ulang',
        },
      });
    } catch (notifErr) {
      console.error('Failed to dispatch DELIVERY_FAILED:', notifErr);
    }

    return res.json({ status: 'success', data: updated });
  } catch (error: any) {
    console.error('Error in markPickupFailedAttempt:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mencatat percobaan jemput' });
  }
};

export const getDriverBoard = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    let targetOutletId = (req.query.outletId as string) || undefined;
    if (!isPrivileged && user.outletId) {
      targetOutletId = user.outletId;
    }

    // 1. Ambil seluruh permintaan penjemputan aktif
    const pickupTasks = await prisma.laundryPickupRequest.findMany({
      where: {
        tenantId: user.tenantId,
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
        status: { in: ['PENDING', 'CONFIRMED', 'DRIVER_ASSIGNED', 'FAILED_ATTEMPT'] },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedDriver: { select: { id: true, name: true, phone: true } },
      },
      orderBy: [{ routeOrder: 'asc' }, { createdAt: 'desc' }],
    });

    // 2. Ambil seluruh order dengan pengantaran aktif
    const deliveryOrders = await prisma.order.findMany({
      where: {
        tenantId: user.tenantId,
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
        orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
        laundryDetail: {
          deliveryType: { not: 'NONE' },
          deliveryStatus: { notIn: ['DELIVERED', 'CANCELLED'] },
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        laundryDetail: true,
      },
      orderBy: [
        { laundryDetail: { deliveryRouteOrder: 'asc' } },
        { createdAt: 'desc' },
      ],
    });

    const totalPendingPickups = pickupTasks.filter((t) => t.status === 'PENDING').length;
    const totalAssignedPickups = pickupTasks.filter((t) => t.status === 'DRIVER_ASSIGNED' || t.status === 'CONFIRMED').length;
    const totalActiveDeliveries = deliveryOrders.length;
    const totalFailedAttempts =
      pickupTasks.filter((t) => t.status === 'FAILED_ATTEMPT').length +
      deliveryOrders.filter((o) => o.laundryDetail?.deliveryStatus === 'FAILED_ATTEMPT').length;

    return res.json({
      status: 'success',
      data: {
        pickupTasks,
        deliveryTasks: deliveryOrders,
        summary: {
          totalPendingPickups,
          totalAssignedPickups,
          totalActiveDeliveries,
          totalFailedAttempts,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in getDriverBoard:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil papan tugas kurir' });
  }
};

const markOrderDeliveryFailedSchema = z.object({
  reason: z.string().min(3, 'Alasan kegagalan minimal 3 karakter').max(500),
  rescheduledAt: z.string().optional().nullable(),
});

export const markOrderDeliveryFailed = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { orderId } = req.params;

    const parseResult = markOrderDeliveryFailedSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi catatan gagal antar pesanan tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { reason, rescheduledAt } = parseResult.data;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: user.tenantId },
      include: { laundryDetail: true, customer: true, outlet: true },
    });

    if (!order || !order.laundryDetail) {
      return res.status(404).json({ status: 'error', message: 'Pesanan laundry tidak ditemukan' });
    }

    const updatedDetail = await prisma.laundryOrderDetail.update({
      where: { id: order.laundryDetail.id },
      data: {
        deliveryStatus: 'FAILED_ATTEMPT',
        deliveryAttemptCount: { increment: 1 },
        deliveryLastFailureReason: reason.trim(),
        deliveryRescheduledAt: rescheduledAt ? new Date(rescheduledAt) : null,
      },
    });

    // Otomatis trigger notifikasi DELIVERY_FAILED ke pelanggan
    try {
      await dispatchDomainEvent({
        tenantId: user.tenantId,
        outletId: order.outletId,
        eventKey: 'DELIVERY_FAILED',
        recipient: {
          name: order.customer?.name || 'Pelanggan',
          phone: order.customer?.phone || null,
        },
        reference: {
          type: 'ORDER',
          id: order.id,
        },
        variables: {
          customerName: order.customer?.name || 'Pelanggan',
          referenceCode: order.invoiceNumber,
          outletName: order.outlet?.name || 'Laundry Kami',
          reason: reason.trim(),
          rescheduledAt: rescheduledAt ? new Date(rescheduledAt).toLocaleString('id-ID') : 'Segera dikonfirmasi ulang',
        },
      });
    } catch (notifErr) {
      console.error('Failed to dispatch DELIVERY_FAILED:', notifErr);
    }

    return res.json({ status: 'success', data: updatedDetail });
  } catch (error: any) {
    console.error('Error in markOrderDeliveryFailed:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mencatat kegagalan antar pesanan' });
  }
};

// ============================================================================
// C. CENTRALIZED NOTIFICATION & AUTOMATION CONTROLLERS
// ============================================================================

export const getAutomationRules = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const outletId = (req.query.outletId as string) || null;

    const rules = await getEffectiveAutomationRules(user.tenantId, outletId);
    return res.json({ status: 'success', data: rules });
  } catch (error: any) {
    console.error('Error in getAutomationRules:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil aturan otomasi notifikasi' });
  }
};

const updateAutomationRuleSchema = z.object({
  outletId: z.string().uuid().optional().nullable(),
  isEnabled: z.boolean(),
  channels: z.array(z.enum(['IN_APP', 'WHATSAPP', 'EMAIL'])).min(1, 'Pilih minimal 1 kanal notifikasi'),
  messageTemplate: z.string().min(5, 'Template pesan minimal 5 karakter').max(2000),
});

export const updateAutomationRule = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { eventKey } = req.params;

    const parseResult = updateAutomationRuleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi aturan otomasi tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, isEnabled, channels, messageTemplate } = parseResult.data;

    const targetOutletId = outletId || null;

    // Cari rule eksisting
    const existingRule = await prisma.notificationAutomationRule.findFirst({
      where: {
        tenantId: user.tenantId,
        outletId: targetOutletId,
        eventKey,
      },
    });

    let savedRule;
    if (existingRule) {
      savedRule = await prisma.notificationAutomationRule.update({
        where: { id: existingRule.id },
        data: {
          isEnabled,
          channels,
          messageTemplate: messageTemplate.trim(),
          updatedById: user.id,
        },
      });
    } else {
      savedRule = await prisma.notificationAutomationRule.create({
        data: {
          tenantId: user.tenantId,
          outletId: targetOutletId,
          eventKey,
          isEnabled,
          channels,
          messageTemplate: messageTemplate.trim(),
          updatedById: user.id,
        },
      });
    }

    return res.json({ status: 'success', data: savedRule });
  } catch (error: any) {
    console.error('Error in updateAutomationRule:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memperbarui aturan otomasi notifikasi' });
  }
};

export const getNotificationLogs = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isPrivileged = user.role === Role.OWNER || user.role === Role.ADMIN;
    let targetOutletId = (req.query.outletId as string) || undefined;
    if (!isPrivileged && user.outletId) {
      targetOutletId = user.outletId;
    }

    const logs = await prisma.notificationDispatchLog.findMany({
      where: {
        tenantId: user.tenantId,
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
        ...(req.query.eventKey ? { eventKey: req.query.eventKey as string } : {}),
        ...(req.query.status ? { status: req.query.status as string } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const totalSent = logs.filter((l) => l.status === 'SENT' || l.status === 'RETRIED').length;
    const totalFailed = logs.filter((l) => l.status === 'FAILED').length;
    const totalSkipped = logs.filter((l) => l.status === 'SKIPPED').length;

    return res.json({
      status: 'success',
      data: logs,
      summary: {
        total: logs.length,
        totalSent,
        totalFailed,
        totalSkipped,
      },
    });
  } catch (error: any) {
    console.error('Error in getNotificationLogs:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengambil riwayat log notifikasi' });
  }
};

export const retryNotificationLog = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { logId } = req.params;

    const retried = await retryDispatchLog(user.tenantId, logId);
    return res.json({ status: 'success', data: retried });
  } catch (error: any) {
    console.error('Error in retryNotificationLog:', error);
    return res.status(500).json({ status: 'error', message: error?.message || 'Gagal mengirim ulang notifikasi' });
  }
};

const simulateNotificationSchema = z.object({
  outletId: z.string().uuid().optional().nullable(),
  eventKey: z.string().min(1),
  recipientName: z.string().optional().nullable(),
  recipientPhone: z.string().optional().nullable(),
  recipientEmail: z.string().email().optional().nullable(),
  variables: z.record(z.any()).optional(),
});

export const simulateNotification = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const parseResult = simulateNotificationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi simulasi notifikasi tidak valid',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { outletId, eventKey, recipientName, recipientPhone, recipientEmail, variables } =
      parseResult.data;

    const logs = await dispatchDomainEvent({
      tenantId: user.tenantId,
      outletId: outletId || null,
      eventKey: eventKey as CanonicalEventKey,
      recipient: {
        name: recipientName || 'Pelanggan Simulasi',
        phone: recipientPhone || null,
        email: recipientEmail || null,
      },
      reference: {
        type: 'SYSTEM',
        id: `SIM-${Date.now()}`,
      },
      variables: {
        customerName: recipientName || 'Bpk. Pelanggan',
        outletName: 'Outlet Laundry Simulator',
        invoiceNumber: 'INV-SIM-001',
        requestCode: 'PKP-SIM-001',
        reason: 'Penerima tidak berada di lokasi',
        rescheduledAt: new Date(Date.now() + 24 * 3600 * 1000).toLocaleString('id-ID'),
        remainingQuota: '10 kg',
        expiryDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toLocaleDateString('id-ID'),
        ...(variables || {}),
      },
      simulateOnly: true,
    });

    return res.json({
      status: 'success',
      data: logs,
      message: 'Simulasi notifikasi berhasil dijalankan',
    });
  } catch (error: any) {
    console.error('Error in simulateNotification:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menjalankan simulasi notifikasi' });
  }
};
