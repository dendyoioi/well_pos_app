import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { recordGlobalAuditLog } from '../services/audit_trail.service';

function generateCode(prefix: string): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${yy}${mm}${dd}-${rand}`;
}

function getAuthContext(req: Request, res: Response) {
  const user = req.user;
  if (!user || !user.tenantId) {
    res.status(401).json({ status: 'error', message: 'Tenant context required' });
    return null;
  }
  return {
    user,
    tenantId: user.tenantId as string,
    outletId: user.outletId || undefined,
  };
}

// ============================================================================
// A. PROCUREMENT 6-STAGE ENDPOINTS
// ============================================================================

/**
 * 1. GET /api/enterprise/core4/procurement/requests
 * Mengambil daftar Purchase Request dengan filter outletId, status, dan pencarian teks.
 */
export async function getPurchaseRequests(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { outletId, status, search } = req.query;

    const where: Prisma.PurchaseRequestWhereInput = {
      tenantId,
      ...(outletId && { outletId: String(outletId) }),
      ...(status && status !== 'ALL' && {
        status: status === 'PENDING' ? { in: ['PENDING', 'SUBMITTED'] } : String(status),
      }),
      ...(search && {
        OR: [
          { prNumber: { contains: String(search), mode: 'insensitive' } },
          { requestedByName: { contains: String(search), mode: 'insensitive' } },
          { notes: { contains: String(search), mode: 'insensitive' } },
        ],
      }),
    };

    const [requests, counts] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include: {
          items: {
            include: {
              inventoryItem: {
                select: { id: true, name: true, itemCode: true, canonicalUom: true, averageCost: true },
              },
            },
          },
          outlet: { select: { id: true, name: true, code: true } },
          storageLocation: { select: { id: true, name: true } },
          convertedPo: { select: { id: true, poNumber: true, status: true, totalAmount: true } },
          requestedBy: { select: { id: true, name: true, email: true, role: true } },
          approvedBy: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100)),
      }),
      prisma.purchaseRequest.groupBy({
        by: ['status'],
        where: {
          tenantId,
          ...(outletId && { outletId: String(outletId) }),
        },
        _count: { _all: true },
      }),
    ]);

    const summary = {
      submitted: 0,
      approved: 0,
      converted: 0,
      rejected: 0,
      total: requests.length,
    };

    for (const c of counts as any[]) {
      const cnt = c._count?._all || 0;
      if (c.status === 'SUBMITTED' || c.status === 'DRAFT' || c.status === 'PENDING') summary.submitted += cnt;
      else if (c.status === 'APPROVED') summary.approved += cnt;
      else if (c.status === 'CONVERTED_TO_PO') summary.converted += cnt;
      else if (c.status === 'REJECTED') summary.rejected += cnt;
    }

    const normalizedRequests = requests.map((r: any) => {
      const estimatedTotal = (r.items || []).reduce(
        (sum: number, it: any) => sum + Number(it.quantityRequested) * Number(it.estimatedUnitCost),
        0
      );
      const itemsWithAliases = (r.items || []).map((it: any) => ({
        ...it,
        inventoryItem: it.inventoryItem
          ? {
              ...it.inventoryItem,
              sku: it.inventoryItem.itemCode,
              unit: it.inventoryItem.canonicalUom,
              costPrice: it.inventoryItem.averageCost,
            }
          : null,
      }));
      return {
        ...r,
        code: r.prNumber,
        estimatedTotal,
        items: itemsWithAliases,
      };
    });

    return res.json({
      status: 'success',
      data: normalizedRequests,
      summary,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 2. POST /api/enterprise/core4/procurement/requests
 * Membuat pengajuan Purchase Request baru beserta daftar item barang.
 */
export async function createPurchaseRequest(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;

    const schema = z.object({
      outletId: z.string().uuid(),
      storageLocationId: z.string().uuid().optional().nullable(),
      priority: z.enum(['NORMAL', 'URGENT']).optional().default('NORMAL'),
      neededByDate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      items: z
        .array(
          z.object({
            inventoryItemId: z.string().uuid(),
            quantityRequested: z.number().positive().optional(),
            quantity: z.number().positive().optional(),
            estimatedUnitCost: z.number().nonnegative().optional(),
            unitCost: z.number().nonnegative().optional(),
            notes: z.string().optional().nullable(),
          })
        )
        .min(1, 'Minimal 1 item barang harus diajukan'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const { outletId, storageLocationId, priority, neededByDate, notes, items } = parsed.data;

    const validOutlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
      select: { id: true },
    });
    if (!validOutlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan pada tenant ini' });
    }

    let prNumber = generateCode('PR');
    let exists = await prisma.purchaseRequest.findUnique({
      where: { tenantId_prNumber: { tenantId, prNumber } },
    });
    while (exists) {
      prNumber = generateCode('PR');
      exists = await prisma.purchaseRequest.findUnique({
        where: { tenantId_prNumber: { tenantId, prNumber } },
      });
    }

    const formattedItems = items.map((it) => {
      const qty = it.quantityRequested ?? it.quantity ?? 1;
      const cost = it.estimatedUnitCost ?? it.unitCost ?? 0;
      return {
        tenantId,
        inventoryItemId: it.inventoryItemId,
        quantityRequested: new Prisma.Decimal(qty),
        estimatedUnitCost: new Prisma.Decimal(cost),
        notes: it.notes || null,
      };
    });

    const calculatedTotal = formattedItems.reduce(
      (sum, it) => sum + Number(it.quantityRequested) * Number(it.estimatedUnitCost),
      0
    );

    const pr = await prisma.purchaseRequest.create({
      data: {
        tenantId,
        outletId,
        storageLocationId: storageLocationId || null,
        prNumber,
        requestedById: user.id,
        requestedByName: user.name || 'Staff',
        status: 'PENDING',
        priority,
        neededByDate: neededByDate ? new Date(neededByDate) : null,
        notes: notes || null,
        items: {
          create: formattedItems,
        },
      },
      include: {
        items: {
          include: {
            inventoryItem: { select: { id: true, name: true, itemCode: true, canonicalUom: true, averageCost: true } },
          },
        },
        outlet: { select: { id: true, name: true } },
      },
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: pr.outletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'PROCUREMENT',
      action: 'CREATE_PURCHASE_REQUEST',
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
      summary: `Purchase Request #${pr.prNumber} dibuat (${items.length} item, Prioritas: ${priority})`,
      afterData: {
        id: pr.id,
        prNumber: pr.prNumber,
        status: pr.status,
        priority: pr.priority,
        itemsCount: items.length,
        estimatedTotal: calculatedTotal,
      },
      ipAddress: req.ip,
    });

    const responsePayload = {
      ...pr,
      code: pr.prNumber,
      estimatedTotal: calculatedTotal,
    };

    return res.status(201).json({ status: 'success', data: responsePayload });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 3. POST /api/enterprise/core4/procurement/requests/:id/review
 * Melakukan approval atau rejection pada Purchase Request oleh OWNER/ADMIN.
 */
export async function reviewPurchaseRequest(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { id } = req.params;

    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED']).optional(),
      decision: z.enum(['APPROVED', 'REJECTED']).optional(),
      rejectionReason: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const finalDecision = parsed.data.status || parsed.data.decision;
    if (!finalDecision) {
      return res.status(400).json({ status: 'error', message: 'Status review (APPROVED / REJECTED) wajib dipilih' });
    }
    const { rejectionReason } = parsed.data;

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id, tenantId },
    });

    if (!pr) {
      return res.status(404).json({ status: 'error', message: 'Purchase Request tidak ditemukan' });
    }

    if (pr.status !== 'SUBMITTED' && pr.status !== 'DRAFT' && pr.status !== 'PENDING') {
      return res.status(400).json({
        status: 'error',
        message: `Hanya PR berstatus PENDING/SUBMITTED yang dapat direview (Status saat ini: ${pr.status})`,
      });
    }

    const updated = await prisma.purchaseRequest.update({
      where: { id: pr.id },
      data: {
        status: finalDecision,
        approvedById: user.id,
        approvedByName: user.name,
        approvedAt: new Date(),
        rejectionReason: finalDecision === 'REJECTED' ? rejectionReason || 'Ditolak oleh manajemen' : null,
      },
      include: {
        items: {
          include: {
            inventoryItem: { select: { id: true, name: true, itemCode: true } },
          },
        },
        outlet: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: updated.outletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'PROCUREMENT',
      action: finalDecision === 'APPROVED' ? 'APPROVE_PURCHASE_REQUEST' : 'REJECT_PURCHASE_REQUEST',
      entityType: 'PURCHASE_REQUEST',
      entityId: updated.id,
      summary:
        finalDecision === 'APPROVED'
          ? `Purchase Request #${updated.prNumber} disetujui oleh ${user.name}`
          : `Purchase Request #${updated.prNumber} ditolak oleh ${user.name}: ${rejectionReason || 'Tanpa alasan'}`,
      beforeData: { status: pr.status },
      afterData: { status: updated.status, rejectionReason: updated.rejectionReason },
      ipAddress: req.ip,
    });

    return res.json({
      status: 'success',
      data: {
        ...updated,
        code: updated.prNumber,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 4. POST /api/enterprise/core4/procurement/requests/:id/convert-to-po
 * Mengonversi Purchase Request yang sudah APPROVED menjadi Purchase Order resmi.
 */
export async function convertPurchaseRequestToPo(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { id } = req.params;

    const schema = z.object({
      supplierId: z.string().uuid('Supplier wajib dipilih'),
      storageLocationId: z.string().uuid().optional().nullable(),
      expectedDeliveryDate: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const { supplierId, storageLocationId, expectedDeliveryDate, notes } = parsed.data;

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id, tenantId },
      include: { items: true },
    });

    if (!pr) {
      return res.status(404).json({ status: 'error', message: 'Purchase Request tidak ditemukan' });
    }

    if (pr.status !== 'APPROVED') {
      return res.status(400).json({
        status: 'error',
        message: 'Hanya PR yang telah disetujui (APPROVED) yang dapat dikonversi ke Purchase Order',
      });
    }

    if (pr.convertedPoId) {
      return res.status(400).json({
        status: 'error',
        message: 'Purchase Request ini sudah pernah dikonversi ke Purchase Order sebelumnya',
      });
    }

    // Tentukan storage location sasaran
    let targetStorageLocationId = storageLocationId || pr.storageLocationId;
    if (!targetStorageLocationId) {
      const defaultLoc = await prisma.storageLocation.findFirst({
        where: { tenantId, outletId: pr.outletId, isActive: true },
      });
      if (defaultLoc) targetStorageLocationId = defaultLoc.id;
      else {
        return res.status(400).json({
          status: 'error',
          message: 'Lokasi gudang penyimpanan (storageLocationId) wajib ditentukan',
        });
      }
    }

    // Hitung subtotal dari PR items
    let subtotalCalc = 0;
    for (const item of pr.items) {
      const qty = Number(item.quantityRequested);
      const cost = Number(item.estimatedUnitCost);
      subtotalCalc += qty * cost;
    }

    let poNumber = generateCode('PO-PR');
    let existsPo = await prisma.purchaseOrder.findUnique({
      where: { tenantId_poNumber: { tenantId, poNumber } },
    });
    while (existsPo) {
      poNumber = generateCode('PO-PR');
      existsPo = await prisma.purchaseOrder.findUnique({
        where: { tenantId_poNumber: { tenantId, poNumber } },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          tenantId,
          outletId: pr.outletId,
          storageLocationId: targetStorageLocationId!,
          supplierId,
          poNumber,
          status: 'ISSUED',
          orderDate: new Date(),
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          subtotal: new Prisma.Decimal(subtotalCalc),
          taxAmount: new Prisma.Decimal(0),
          totalAmount: new Prisma.Decimal(subtotalCalc),
          notes: notes || pr.notes || null,
          createdByUserId: user.id,
          items: {
            create: pr.items.map((item: any) => {
              const qty = Number(item.quantityRequested);
              const cost = Number(item.estimatedUnitCost);
              return {
                tenantId,
                inventoryItemId: item.inventoryItemId,
                quantityOrdered: new Prisma.Decimal(qty),
                quantityReceived: new Prisma.Decimal(0),
                unitCost: new Prisma.Decimal(cost),
                subtotal: new Prisma.Decimal(qty * cost),
                notes: item.notes || null,
              };
            }),
          },
        },
        include: {
          items: true,
          supplier: { select: { id: true, name: true, code: true } },
        },
      });

      const updatedPr = await tx.purchaseRequest.update({
        where: { id: pr.id },
        data: {
          status: 'CONVERTED_TO_PO',
          convertedPoId: po.id,
        },
        include: {
          items: true,
          convertedPo: { select: { id: true, poNumber: true, status: true, totalAmount: true } },
        },
      });

      return { po, pr: updatedPr };
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: pr.outletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'PROCUREMENT',
      action: 'CONVERT_PR_TO_PO',
      entityType: 'PURCHASE_REQUEST',
      entityId: pr.id,
      summary: `Purchase Request #${pr.prNumber} berhasil dikonversi ke Purchase Order #${result.po.poNumber}`,
      afterData: { prId: pr.id, poId: result.po.id, poNumber: result.po.poNumber },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      status: 'success',
      data: {
        purchaseRequest: { ...result.pr, code: result.pr.prNumber },
        purchaseOrder: { ...result.po, orderNumber: result.po.poNumber },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

export const convertToPurchaseOrder = convertPurchaseRequestToPo;

/**
 * 5. GET /api/enterprise/core4/procurement/invoices
 * Mengambil daftar invoice/tagihan supplier (AP) beserta rangkuman piutang/hutang.
 */
export async function getSupplierInvoices(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { outletId, status, supplierId, search } = req.query;

    const where: Prisma.SupplierInvoiceWhereInput = {
      tenantId,
      ...(outletId && { outletId: String(outletId) }),
      ...(status && status !== 'ALL' && { status: String(status) }),
      ...(supplierId && { supplierId: String(supplierId) }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: String(search), mode: 'insensitive' } },
          { supplierInvoiceRef: { contains: String(search), mode: 'insensitive' } },
          { notes: { contains: String(search), mode: 'insensitive' } },
          { supplier: { name: { contains: String(search), mode: 'insensitive' } } },
        ],
      }),
    };

    const invoices = await prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true, phone: true } },
        purchaseOrder: { select: { id: true, poNumber: true, status: true, totalAmount: true } },
        outlet: { select: { id: true, name: true } },
        payments: {
          include: { paidBy: { select: { id: true, name: true } } },
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100)),
    });

    let totalAmount = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let overdueCount = 0;
    const now = new Date();

    for (const inv of invoices) {
      totalAmount += Number(inv.totalAmount);
      totalPaid += Number(inv.paidAmount);
      totalRemaining += Number(inv.remainingAmount);
      if (inv.status !== 'PAID' && inv.dueDate && new Date(inv.dueDate) < now) {
        overdueCount++;
      }
    }

    return res.json({
      status: 'success',
      data: invoices,
      summary: {
        totalInvoices: invoices.length,
        totalAmount,
        totalPaid,
        totalRemaining,
        overdueCount,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 6. POST /api/enterprise/core4/procurement/invoices
 * Membuat tagihan/AP supplier baru (bisa merujuk PO atau manual).
 */
export async function createSupplierInvoice(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;

    const schema = z.object({
      outletId: z.string().uuid().optional(),
      supplierId: z.string().uuid().optional(),
      purchaseOrderId: z.string().uuid().optional().nullable(),
      invoiceNumber: z.string().optional(),
      supplierInvoiceRef: z.string().optional().nullable(),
      invoiceDate: z.string().optional(),
      dueDate: z.string().optional().nullable(),
      amount: z.number().nonnegative().optional(),
      subtotal: z.number().nonnegative().optional(),
      taxAmount: z.number().nonnegative().optional().default(0),
      discountAmount: z.number().nonnegative().optional().default(0),
      totalAmount: z.number().nonnegative().optional(),
      notes: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    let {
      outletId,
      supplierId,
      purchaseOrderId,
      invoiceNumber,
      supplierInvoiceRef,
      invoiceDate,
      dueDate,
      amount,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      notes,
    } = parsed.data;

    let targetSupplierName = 'Supplier';

    // Jika purchaseOrderId diberikan, auto-populate data dari PO
    if (purchaseOrderId) {
      const po = await prisma.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, tenantId },
        include: { supplier: true },
      });
      if (!po) {
        return res.status(404).json({ status: 'error', message: 'Purchase Order rujukan tidak ditemukan' });
      }
      if (!supplierId) supplierId = po.supplierId;
      if (!outletId) outletId = po.outletId;
      if (subtotal === undefined) subtotal = Number(po.subtotal);
      if (totalAmount === undefined && !taxAmount && !discountAmount) {
        totalAmount = Number(po.totalAmount);
      }
      if (po.supplier) targetSupplierName = po.supplier.name;
    }

    if (!supplierId) {
      return res.status(400).json({ status: 'error', message: 'Supplier wajib dipilih' });
    }

    if (!outletId) {
      const defaultOutlet = await prisma.outlet.findFirst({ where: { tenantId } });
      if (defaultOutlet) outletId = defaultOutlet.id;
      else return res.status(400).json({ status: 'error', message: 'Outlet wajib ditentukan' });
    }

    if (targetSupplierName === 'Supplier' && supplierId) {
      const s = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
      if (s) targetSupplierName = s.name;
    }

    const finalSubtotal = subtotal ?? amount ?? 0;
    const finalTax = taxAmount || 0;
    const finalDiscount = discountAmount || 0;
    const finalTotal =
      totalAmount !== undefined ? totalAmount : Math.max(0, finalSubtotal + finalTax - finalDiscount);

    let finalInvoiceNumber = invoiceNumber?.trim() || generateCode('AP');
    let exists = await prisma.supplierInvoice.findUnique({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber: finalInvoiceNumber } },
    });
    while (exists) {
      finalInvoiceNumber = generateCode('AP');
      exists = await prisma.supplierInvoice.findUnique({
        where: { tenantId_invoiceNumber: { tenantId, invoiceNumber: finalInvoiceNumber } },
      });
    }

    const invoice = await prisma.supplierInvoice.create({
      data: {
        tenantId,
        outletId,
        supplierId,
        purchaseOrderId: purchaseOrderId || null,
        invoiceNumber: finalInvoiceNumber,
        supplierInvoiceRef: supplierInvoiceRef || null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        subtotal: new Prisma.Decimal(finalSubtotal),
        taxAmount: new Prisma.Decimal(finalTax),
        totalAmount: new Prisma.Decimal(finalTotal),
        paidAmount: new Prisma.Decimal(0),
        remainingAmount: new Prisma.Decimal(finalTotal),
        status: 'UNPAID',
        notes: notes || null,
        createdById: user.id,
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        purchaseOrder: { select: { id: true, poNumber: true } },
        outlet: { select: { id: true, name: true } },
      },
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: invoice.outletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'PROCUREMENT',
      action: 'CREATE_SUPPLIER_INVOICE',
      entityType: 'SUPPLIER_INVOICE',
      entityId: invoice.id,
      summary: `Tagihan Supplier #${invoice.invoiceNumber} sebesar Rp ${finalTotal.toLocaleString('id-ID')} diterbitkan (${targetSupplierName})`,
      afterData: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierId: invoice.supplierId,
        totalAmount: Number(invoice.totalAmount),
        status: invoice.status,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({ status: 'success', data: invoice });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 7. POST /api/enterprise/core4/procurement/invoices/:id/payments
 * Mencatat pembayaran tagihan supplier (AP) sebagian atau pelunasan penuh.
 */
export async function paySupplierInvoice(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { id } = req.params;

    const schema = z.object({
      amount: z.number().positive('Nominal pembayaran wajib lebih besar dari 0'),
      paymentMethod: z.string().optional().default('BANK_TRANSFER'),
      referenceNumber: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const { amount, paymentMethod, referenceNumber, notes } = parsed.data;

    const invoice = await prisma.supplierInvoice.findFirst({
      where: { id, tenantId },
    });

    if (!invoice) {
      return res.status(404).json({ status: 'error', message: 'Tagihan supplier tidak ditemukan' });
    }

    if (invoice.status === 'PAID') {
      return res.status(400).json({ status: 'error', message: 'Tagihan supplier ini sudah berstatus LUNAS (PAID)' });
    }

    const remaining = Number(invoice.remainingAmount);
    if (amount > remaining + 0.01) {
      return res.status(400).json({
        status: 'error',
        message: `Nominal pembayaran (Rp ${amount.toLocaleString('id-ID')}) tidak boleh melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')})`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.supplierInvoicePayment.create({
        data: {
          tenantId,
          supplierInvoiceId: invoice.id,
          amount: new Prisma.Decimal(amount),
          paymentMethod,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          paidAt: new Date(),
          paidById: user.id,
        },
      });

      const newPaid = Number(invoice.paidAmount) + amount;
      const newRemaining = Math.max(0, Number(invoice.totalAmount) - newPaid);
      const newStatus = newRemaining <= 0.01 ? 'PAID' : 'PARTIAL';

      const updated = await tx.supplierInvoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: new Prisma.Decimal(newPaid),
          remainingAmount: new Prisma.Decimal(newRemaining),
          status: newStatus,
        },
        include: {
          supplier: { select: { id: true, name: true } },
          payments: { orderBy: { paidAt: 'desc' } },
        },
      });

      return { payment, invoice: updated };
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: invoice.outletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'PROCUREMENT',
      action: 'PAY_SUPPLIER_INVOICE',
      entityType: 'SUPPLIER_INVOICE',
      entityId: invoice.id,
      summary: `Pembayaran tagihan supplier #${invoice.invoiceNumber} sebesar Rp ${amount.toLocaleString('id-ID')} (${result.invoice.status})`,
      afterData: { paymentId: result.payment.id, newPaid: result.invoice.paidAmount, newStatus: result.invoice.status },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      status: 'success',
      data: result,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

// ============================================================================
// B. WORKFORCE ENTERPRISE — OVERTIME, LEAVE, & PAYROLL REKAP
// ============================================================================

/**
 * 8. GET /api/enterprise/core4/workforce/overtimes
 * Mengambil daftar pengajuan lembur dengan filter outletId, status, userId, dan bulan (YYYY-MM).
 */
export async function getOvertimeRequests(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { outletId, status, userId, month } = req.query;

    const isManager = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(user.role);
    const filterUserId = isManager ? (userId ? String(userId) : undefined) : user.id;

    const where: Prisma.StaffOvertimeRequestWhereInput = {
      tenantId,
      ...(outletId && { outletId: String(outletId) }),
      ...(status && status !== 'ALL' && { status: String(status) }),
      ...(filterUserId && { userId: filterUserId }),
      ...(month && { workDate: { startsWith: String(month) } }),
    };

    const overtimes = await prisma.staffOvertimeRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, userCode: true, role: true } },
        outlet: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100)),
    });

    let approvedHours = 0;
    let totalApprovedPay = 0;
    let pendingCount = 0;

    for (const ot of overtimes) {
      if (ot.status === 'APPROVED') {
        approvedHours += Number(ot.hours);
        totalApprovedPay += Number(ot.totalPay);
      } else if (ot.status === 'PENDING') {
        pendingCount++;
      }
    }

    return res.json({
      status: 'success',
      data: overtimes,
      summary: {
        totalRequests: overtimes.length,
        pendingCount,
        approvedHours,
        totalApprovedPay,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 9. POST /api/enterprise/core4/workforce/overtimes
 * Membuat pengajuan lembur untuk staf (totalPay dihitung otomatis).
 */
export async function createOvertimeRequest(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;

    const schema = z.object({
      outletId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      workDate: z.string().optional(),
      overtimeDate: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      hours: z.number().positive().optional(),
      durationHours: z.number().positive().optional(),
      hourlyRate: z.number().nonnegative().optional(),
      reason: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const {
      outletId,
      userId,
      workDate,
      overtimeDate,
      startTime,
      endTime,
      hours,
      durationHours,
      hourlyRate,
      reason,
    } = parsed.data;

    const isManager = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(user.role);
    const targetUserId = isManager && userId ? userId : user.id;
    const finalHours = hours ?? durationHours ?? 1;

    let finalWorkDate = workDate || overtimeDate;
    if (!finalWorkDate) {
      finalWorkDate = new Date().toISOString().slice(0, 10);
    } else if (finalWorkDate.includes('T')) {
      finalWorkDate = finalWorkDate.slice(0, 10);
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: { id: true, name: true, role: true, outletId: true },
    });

    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'Staf target tidak ditemukan' });
    }

    const finalOutletId = outletId || targetUser.outletId || user.outletId;
    if (!finalOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet wajib ditentukan' });
    }

    const effectiveRate = hourlyRate !== undefined ? hourlyRate : 25000;
    // Standar Depnaker / Enterprise: Overtime = hours * 1.5 * hourlyRate
    const totalPay = finalHours * 1.5 * effectiveRate;

    const overtime = await prisma.staffOvertimeRequest.create({
      data: {
        tenantId,
        outletId: finalOutletId,
        userId: targetUserId,
        workDate: finalWorkDate,
        hours: new Prisma.Decimal(finalHours),
        hourlyRate: new Prisma.Decimal(effectiveRate),
        totalPay: new Prisma.Decimal(totalPay),
        reason: reason || null,
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, name: true, userCode: true, role: true } },
        outlet: { select: { id: true, name: true } },
      },
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: finalOutletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'HR_PAYROLL',
      action: 'SUBMIT_OVERTIME',
      entityType: 'STAFF_OVERTIME_REQUEST',
      entityId: overtime.id,
      summary: `Pengajuan lembur ${finalHours} jam pada ${finalWorkDate} untuk ${targetUser.name}`,
      afterData: {
        id: overtime.id,
        userId: overtime.userId,
        workDate: overtime.workDate,
        hours: Number(overtime.hours),
        totalPay: Number(overtime.totalPay),
        status: overtime.status,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      status: 'success',
      data: {
        ...overtime,
        estimatedPay: totalPay,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 10. POST /api/enterprise/core4/workforce/overtimes/:id/review
 * Review persetujuan lembur oleh OWNER/ADMIN/SUPERVISOR.
 */
export async function reviewOvertimeRequest(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { id } = req.params;

    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED']).optional(),
      decision: z.enum(['APPROVED', 'REJECTED']).optional(),
      rejectionReason: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const finalDecision = parsed.data.status || parsed.data.decision;
    if (!finalDecision) {
      return res.status(400).json({ status: 'error', message: 'Status review (APPROVED / REJECTED) wajib dipilih' });
    }
    const { rejectionReason } = parsed.data;

    const ot = await prisma.staffOvertimeRequest.findFirst({
      where: { id, tenantId },
      include: { user: { select: { name: true } } },
    });

    if (!ot) {
      return res.status(404).json({ status: 'error', message: 'Pengajuan lembur tidak ditemukan' });
    }

    const updated = await prisma.staffOvertimeRequest.update({
      where: { id: ot.id },
      data: {
        status: finalDecision,
        approvedById: user.id,
        approvedAt: new Date(),
        rejectionReason: finalDecision === 'REJECTED' ? rejectionReason || 'Ditolak' : null,
      },
      include: {
        user: { select: { id: true, name: true, userCode: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: ot.outletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'HR_PAYROLL',
      action: finalDecision === 'APPROVED' ? 'APPROVE_OVERTIME' : 'REJECT_OVERTIME',
      entityType: 'STAFF_OVERTIME_REQUEST',
      entityId: ot.id,
      summary: `Pengajuan lembur #${ot.id.slice(-6)} (${ot.user?.name || 'Staff'}) ${finalDecision.toLowerCase()} oleh ${user.name}`,
      afterData: { status: updated.status, rejectionReason: updated.rejectionReason },
      ipAddress: req.ip,
    });

    return res.json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 11. GET /api/enterprise/core4/workforce/leaves
 * Mengambil daftar pengajuan cuti/izin staf.
 */
export async function getLeaveRequests(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { outletId, status, userId, leaveType } = req.query;

    const isManager = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(user.role);
    const filterUserId = isManager ? (userId ? String(userId) : undefined) : user.id;

    const where: Prisma.StaffLeaveRequestWhereInput = {
      tenantId,
      ...(outletId && { outletId: String(outletId) }),
      ...(status && status !== 'ALL' && { status: String(status) }),
      ...(filterUserId && { userId: filterUserId }),
      ...(leaveType && { leaveType: String(leaveType) }),
    };

    const leaves = await prisma.staffLeaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, userCode: true, role: true } },
        outlet: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100)),
    });

    let pendingCount = 0;
    let approvedDays = 0;

    for (const lv of leaves) {
      if (lv.status === 'PENDING') pendingCount++;
      else if (lv.status === 'APPROVED') approvedDays += lv.totalDays;
    }

    return res.json({
      status: 'success',
      data: leaves,
      summary: {
        totalRequests: leaves.length,
        pendingCount,
        approvedDays,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 12. POST /api/enterprise/core4/workforce/leaves
 * Membuat pengajuan cuti atau izin untuk staf.
 */
export async function createLeaveRequest(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;

    const schema = z.object({
      outletId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      leaveType: z.enum(['ANNUAL', 'SICK', 'UNPAID', 'EMERGENCY']).optional().default('ANNUAL'),
      startDate: z.string(),
      endDate: z.string(),
      totalDays: z.number().int().positive().optional(),
      durationDays: z.number().int().positive().optional(),
      reason: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const { outletId, userId, leaveType, startDate, endDate, totalDays, durationDays, reason } = parsed.data;
    const isManager = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(user.role);
    const targetUserId = isManager && userId ? userId : user.id;

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId },
      select: { id: true, name: true, outletId: true },
    });

    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'Staf target tidak ditemukan' });
    }

    const finalOutletId = outletId || targetUser.outletId || user.outletId;
    if (!finalOutletId) {
      return res.status(400).json({ status: 'error', message: 'Outlet wajib ditentukan' });
    }

    const cleanStartDate = startDate.includes('T') ? startDate.slice(0, 10) : startDate;
    const cleanEndDate = endDate.includes('T') ? endDate.slice(0, 10) : endDate;

    let calculatedDays = totalDays ?? durationDays;
    if (!calculatedDays) {
      const d1 = new Date(cleanStartDate).getTime();
      const d2 = new Date(cleanEndDate).getTime();
      calculatedDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
    }

    const leave = await prisma.staffLeaveRequest.create({
      data: {
        tenantId,
        outletId: finalOutletId,
        userId: targetUserId,
        leaveType,
        startDate: cleanStartDate,
        endDate: cleanEndDate,
        totalDays: calculatedDays,
        reason: reason || null,
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, name: true, userCode: true, role: true } },
        outlet: { select: { id: true, name: true } },
      },
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: finalOutletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'HR_PAYROLL',
      action: 'SUBMIT_LEAVE',
      entityType: 'STAFF_LEAVE_REQUEST',
      entityId: leave.id,
      summary: `Pengajuan cuti ${leaveType} (${calculatedDays} hari: ${cleanStartDate} s.d ${cleanEndDate}) untuk ${targetUser.name}`,
      afterData: {
        id: leave.id,
        userId: leave.userId,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        totalDays: leave.totalDays,
        status: leave.status,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({ status: 'success', data: leave });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 13. POST /api/enterprise/core4/workforce/leaves/:id/review
 * Review persetujuan cuti oleh OWNER/ADMIN/SUPERVISOR.
 */
export async function reviewLeaveRequest(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { id } = req.params;

    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED']).optional(),
      decision: z.enum(['APPROVED', 'REJECTED']).optional(),
      rejectionReason: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const finalDecision = parsed.data.status || parsed.data.decision;
    if (!finalDecision) {
      return res.status(400).json({ status: 'error', message: 'Status review (APPROVED / REJECTED) wajib dipilih' });
    }
    const { rejectionReason } = parsed.data;

    const lv = await prisma.staffLeaveRequest.findFirst({
      where: { id, tenantId },
      include: { user: { select: { name: true } } },
    });

    if (!lv) {
      return res.status(404).json({ status: 'error', message: 'Pengajuan cuti tidak ditemukan' });
    }

    const updated = await prisma.staffLeaveRequest.update({
      where: { id: lv.id },
      data: {
        status: finalDecision,
        approvedById: user.id,
        approvedAt: new Date(),
        rejectionReason: finalDecision === 'REJECTED' ? rejectionReason || 'Ditolak' : null,
      },
      include: {
        user: { select: { id: true, name: true, userCode: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: lv.outletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'HR_PAYROLL',
      action: finalDecision === 'APPROVED' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE',
      entityType: 'STAFF_LEAVE_REQUEST',
      entityId: lv.id,
      summary: `Pengajuan cuti #${lv.id.slice(-6)} (${lv.user?.name || 'Staff'}) ${finalDecision.toLowerCase()} oleh ${user.name}`,
      afterData: { status: updated.status, rejectionReason: updated.rejectionReason },
      ipAddress: req.ip,
    });

    return res.json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 14. GET /api/enterprise/core4/workforce/payroll
 * Mengambil daftar slip gaji / rekap payroll per periode & outlet.
 */
export async function getPayrollSlips(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { outletId, periodYear, periodMonth, userId, status } = req.query;

    const where: Prisma.StaffPayrollSlipWhereInput = {
      tenantId,
      ...(outletId && { outletId: String(outletId) }),
      ...(periodYear && { periodYear: parseInt(String(periodYear), 10) }),
      ...(periodMonth && { periodMonth: parseInt(String(periodMonth), 10) }),
      ...(userId && { userId: String(userId) }),
      ...(status && status !== 'ALL' && { status: String(status) }),
    };

    const slips = await prisma.staffPayrollSlip.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, userCode: true, role: true, phone: true } },
        outlet: { select: { id: true, name: true } },
        generatedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(200, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100)),
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNetSalary = 0;
    let totalPaidCount = 0;

    for (const s of slips) {
      const gross =
        Number(s.baseSalary) +
        Number(s.overtimePay) +
        Number(s.commissionPay) +
        Number(s.bonusAmount);
      const ded = Number(s.cashAdvanceDeduction) + Number(s.otherDeduction);
      totalGross += gross;
      totalDeductions += ded;
      totalNetSalary += Number(s.netSalary);
      if (s.status === 'PAID') totalPaidCount++;
    }

    return res.json({
      status: 'success',
      data: slips,
      summary: {
        totalSlips: slips.length,
        totalGross,
        totalDeductions,
        totalNetSalary,
        totalPaidCount,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 15. POST /api/enterprise/core4/workforce/payroll/generate
 * Generate atau upsert slip gaji staf dengan kalkulasi otomatis lembur dan potongan kasbon.
 */
export async function generatePayrollSlip(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;

    const schema = z.object({
      outletId: z.string().uuid(),
      userId: z.string().uuid(),
      periodYear: z.number().int(),
      periodMonth: z.number().int().min(1).max(12),
      baseSalary: z.number().nonnegative().optional(),
      allowances: z.number().nonnegative().optional(),
      commissionPay: z.number().nonnegative().optional().default(0),
      bonusAmount: z.number().nonnegative().optional().default(0),
      cashAdvanceDeduction: z.number().nonnegative().optional(),
      deductions: z.number().nonnegative().optional(),
      otherDeduction: z.number().nonnegative().optional().default(0),
      autoPullOvertime: z.boolean().optional().default(true),
      autoPullCashAdvance: z.boolean().optional().default(false),
      notes: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const {
      outletId,
      userId,
      periodYear,
      periodMonth,
      baseSalary: rawBaseSalary,
      allowances,
      commissionPay,
      bonusAmount,
      cashAdvanceDeduction,
      deductions,
      otherDeduction,
      autoPullOvertime,
      autoPullCashAdvance,
      notes,
    } = parsed.data;

    const validOutlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
      select: { id: true },
    });
    if (!validOutlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan pada tenant ini' });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      return res.status(404).json({ status: 'error', message: 'Staf target tidak ditemukan' });
    }

    const baseSalary = rawBaseSalary !== undefined ? rawBaseSalary : 3500000;

    // Cek apakah slip sudah ada dan sudah PAID
    const existing = await prisma.staffPayrollSlip.findUnique({
      where: {
        tenantId_outletId_userId_periodYear_periodMonth: {
          tenantId,
          outletId,
          userId,
          periodYear,
          periodMonth,
        },
      },
    });

    if (existing && existing.status === 'PAID') {
      return res.status(400).json({
        status: 'error',
        message: 'Slip gaji periode ini sudah berstatus LUNAS (PAID) dan tidak dapat diubah kembali',
      });
    }

    // 1. Tarik lembur approved otomatis jika autoPullOvertime !== false
    let overtimePay = 0;
    if (autoPullOvertime !== false) {
      const monthPrefix = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
      const approvedOvertimes = await prisma.staffOvertimeRequest.findMany({
        where: {
          tenantId,
          userId,
          status: 'APPROVED',
          workDate: { startsWith: monthPrefix },
        },
      });
      for (const ot of approvedOvertimes) {
        overtimePay += Number(ot.totalPay);
      }
    }

    // 2. Tarik potongan kasbon jika autoPullCashAdvance === true dan deduction tidak diisi manual
    let finalCashAdvanceDeduction = cashAdvanceDeduction !== undefined ? cashAdvanceDeduction : 0;
    if (autoPullCashAdvance && cashAdvanceDeduction === undefined) {
      const activeAdvances = await prisma.staffCashAdvance.findMany({
        where: {
          tenantId,
          staffId: userId,
          status: { in: ['OPEN', 'PARTIAL'] },
        },
      });
      let totalRemainingAdvance = 0;
      for (const adv of activeAdvances) {
        totalRemainingAdvance += Number(adv.remainingAmount);
      }
      const grossIncome = baseSalary + overtimePay + (commissionPay || 0) + (bonusAmount || 0);
      finalCashAdvanceDeduction = Math.min(totalRemainingAdvance, grossIncome);
    }

    // Tunjangan lain (allowances dimasukkan ke bonusAmount jika diisi)
    const finalBonus = (bonusAmount || 0) + (allowances || 0);
    // Potongan lain (deductions dimasukkan ke otherDeduction jika diisi)
    const finalOtherDeduction = (otherDeduction || 0) + (deductions || 0);

    // 3. Hitung Gaji Bersih (Net Salary)
    const gross = baseSalary + overtimePay + (commissionPay || 0) + finalBonus;
    const totalDeductionCalc = finalCashAdvanceDeduction + finalOtherDeduction;
    const netSalary = Math.max(0, gross - totalDeductionCalc);

    const slip = await prisma.staffPayrollSlip.upsert({
      where: {
        tenantId_outletId_userId_periodYear_periodMonth: {
          tenantId,
          outletId,
          userId,
          periodYear,
          periodMonth,
        },
      },
      create: {
        tenantId,
        outletId,
        userId,
        periodYear,
        periodMonth,
        baseSalary: new Prisma.Decimal(baseSalary),
        overtimePay: new Prisma.Decimal(overtimePay),
        commissionPay: new Prisma.Decimal(commissionPay || 0),
        bonusAmount: new Prisma.Decimal(finalBonus),
        cashAdvanceDeduction: new Prisma.Decimal(finalCashAdvanceDeduction),
        otherDeduction: new Prisma.Decimal(finalOtherDeduction),
        netSalary: new Prisma.Decimal(netSalary),
        status: 'DRAFT',
        notes: notes || null,
        generatedById: user.id,
      },
      update: {
        baseSalary: new Prisma.Decimal(baseSalary),
        overtimePay: new Prisma.Decimal(overtimePay),
        commissionPay: new Prisma.Decimal(commissionPay || 0),
        bonusAmount: new Prisma.Decimal(finalBonus),
        cashAdvanceDeduction: new Prisma.Decimal(finalCashAdvanceDeduction),
        otherDeduction: new Prisma.Decimal(finalOtherDeduction),
        netSalary: new Prisma.Decimal(netSalary),
        notes: notes || null,
        generatedById: user.id,
      },
      include: {
        user: { select: { id: true, name: true, userCode: true, role: true } },
        outlet: { select: { id: true, name: true } },
        generatedBy: { select: { id: true, name: true } },
      },
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'HR_PAYROLL',
      action: 'GENERATE_PAYROLL_SLIP',
      entityType: 'STAFF_PAYROLL_SLIP',
      entityId: slip.id,
      summary: `Slip gaji periode ${periodYear}-${String(periodMonth).padStart(2, '0')} untuk ${targetUser.name} dibuat (Net: Rp ${netSalary.toLocaleString('id-ID')})`,
      afterData: {
        id: slip.id,
        userId: slip.userId,
        periodYear,
        periodMonth,
        netSalary: Number(slip.netSalary),
        status: slip.status,
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({ status: 'success', data: slip });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

/**
 * 16. POST /api/enterprise/core4/workforce/payroll/:id/status
 * Memperbarui status slip gaji (FINALIZED atau PAID).
 */
export async function updatePayrollSlipStatus(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { id } = req.params;

    const schema = z.object({
      status: z.enum(['FINALIZED', 'PAID']),
      paymentMethod: z.string().optional().nullable(),
      paymentReference: z.string().optional().nullable(),
      paidAt: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: 'error', message: parsed.error.issues[0]?.message });
    }

    const { status, paymentMethod, paymentReference, paidAt, notes } = parsed.data;

    const slip = await prisma.staffPayrollSlip.findFirst({
      where: { id, tenantId },
      include: { user: { select: { name: true } } },
    });

    if (!slip) {
      return res.status(404).json({ status: 'error', message: 'Slip gaji tidak ditemukan' });
    }

    const finalNotes = notes || (paymentReference ? `Ref: ${paymentReference}` : slip.notes);

    const updated = await prisma.staffPayrollSlip.update({
      where: { id: slip.id },
      data: {
        status,
        paymentMethod: paymentMethod || slip.paymentMethod || null,
        paidAt: status === 'PAID' ? (paidAt ? new Date(paidAt) : new Date()) : null,
        notes: finalNotes,
      },
      include: {
        user: { select: { id: true, name: true, userCode: true } },
        outlet: { select: { id: true, name: true } },
      },
    });

    await recordGlobalAuditLog({
      tenantId,
      outletId: slip.outletId,
      actorUserId: user.id,
      actorName: user.name,
      actorRole: user.role,
      module: 'HR_PAYROLL',
      action: 'UPDATE_PAYROLL_STATUS',
      entityType: 'STAFF_PAYROLL_SLIP',
      entityId: slip.id,
      summary: `Slip gaji periode ${slip.periodYear}-${String(slip.periodMonth).padStart(2, '0')} (${slip.user?.name || 'Staff'}) berstatus ${status}`,
      afterData: { status: updated.status, paidAt: updated.paidAt },
      ipAddress: req.ip,
    });

    return res.json({ status: 'success', data: updated });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}

// ============================================================================
// C. GLOBAL AUDIT TRAIL ENDPOINTS
// ============================================================================

/**
 * 17. GET /api/enterprise/core4/audit-logs
 * Mengambil jejak audit aktivitas sistem lintas modul dengan filter dan pencarian.
 */
export async function getGlobalAuditLogs(req: Request, res: Response) {
  try {
    const auth = getAuthContext(req, res);
    if (!auth) return;
    const { user, tenantId } = auth;
    const { outletId, module, action, search, limit = '50', offset = '0' } = req.query;

    const parsedLimit = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 50));
    const parsedOffset = Math.max(0, parseInt(String(offset), 10) || 0);

    const where: Prisma.GlobalAuditLogWhereInput = {
      tenantId,
      ...(outletId && { outletId: String(outletId) }),
      ...(module && module !== 'ALL' && { module: String(module) }),
      ...(action && { action: String(action) }),
      ...(search && {
        OR: [
          { summary: { contains: String(search), mode: 'insensitive' } },
          { actorName: { contains: String(search), mode: 'insensitive' } },
          { entityType: { contains: String(search), mode: 'insensitive' } },
          { entityId: { contains: String(search), mode: 'insensitive' } },
        ],
      }),
    };

    const [logs, total, moduleCounts] = await Promise.all([
      prisma.globalAuditLog.findMany({
        where,
        include: {
          outlet: { select: { id: true, name: true } },
          actorUser: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: parsedLimit,
        skip: parsedOffset,
      }),
      prisma.globalAuditLog.count({ where }),
      prisma.globalAuditLog.groupBy({
        by: ['module'],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);

    const summary: Record<string, number> = {
      PROCUREMENT: 0,
      HR_PAYROLL: 0,
      ORDER: 0,
      PRICING: 0,
      FINANCE: 0,
      SECURITY: 0,
      SYSTEM: 0,
    };

    for (const mc of moduleCounts as any[]) {
      if (mc.module) {
        summary[mc.module] = mc._count?._all || 0;
      }
    }

    return res.json({
      status: 'success',
      data: logs,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
      summary,
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
