import { prisma } from '../config/prisma';
import { whatsAppService } from './whatsapp.service';

export type CanonicalEventKey =
  | 'ORDER_CREATED'
  | 'ORDER_READY'
  | 'ORDER_OVERDUE'
  | 'PICKUP_REQUEST_CONFIRMED'
  | 'DELIVERY_FAILED'
  | 'CUSTOMER_DORMANT_WINBACK'
  | 'QUOTA_EXPIRING';

export type NotificationChannel = 'IN_APP' | 'WHATSAPP' | 'EMAIL';

export interface AutomationRuleConfig {
  eventKey: CanonicalEventKey;
  isEnabled: boolean;
  channels: NotificationChannel[];
  messageTemplate: string;
}

export const DEFAULT_AUTOMATION_RULES: Record<CanonicalEventKey, { isEnabled: boolean; channels: NotificationChannel[]; messageTemplate: string }> = {
  ORDER_CREATED: {
    isEnabled: true,
    channels: ['IN_APP', 'WHATSAPP'],
    messageTemplate:
      'Halo {{customerName}}, pesanan cucian Anda dengan nomor nota #{{invoiceNumber}} telah kami terima di {{outletName}}. Estimasi selesai: {{estimatedReadyAt}}. Terima kasih telah mempercayakan pakaian Anda kepada kami!',
  },
  ORDER_READY: {
    isEnabled: true,
    channels: ['IN_APP', 'WHATSAPP'],
    messageTemplate:
      'Kabar gembira {{customerName}}! Cucian Anda #{{invoiceNumber}} sudah SELESAI, bersih, dan wangi di {{outletName}}. Anda dapat mengambilnya di rak {{rackCode}} atau menunggu jadwal kurir kami.',
  },
  ORDER_OVERDUE: {
    isEnabled: true,
    channels: ['IN_APP'],
    messageTemplate:
      '[PERINGATAN SLA] Pesanan #{{invoiceNumber}} atas nama {{customerName}} di {{outletName}} telah melewati estimasi waktu selesai. Mohon segera diprioritaskan di workshop!',
  },
  PICKUP_REQUEST_CONFIRMED: {
    isEnabled: true,
    channels: ['IN_APP', 'WHATSAPP'],
    messageTemplate:
      'Halo {{customerName}}, permintaan jemput cucian Anda (Kode: {{requestCode}}) telah DIKONFIRMASI oleh {{outletName}}. Kurir {{courierName}} ({{courierPhone}}) akan segera menuju lokasi penjemputan.',
  },
  DELIVERY_FAILED: {
    isEnabled: true,
    channels: ['IN_APP', 'WHATSAPP'],
    messageTemplate:
      'Mohon maaf {{customerName}}, proses antar/jemput cucian Anda ({{referenceCode}}) di {{outletName}} belum berhasil dilaksanakan. Alasan: {{reason}}. Jadwal ulang: {{rescheduledAt}}. Hubungi kami jika ada pertanyaan.',
  },
  CUSTOMER_DORMANT_WINBACK: {
    isEnabled: true,
    channels: ['WHATSAPP'],
    messageTemplate:
      'Halo {{customerName}}, kami rindu Anda di {{outletName}}! Dapatkan diskon spesial untuk cuci bersih pakaian favorit Anda minggu ini. Kunjungi outlet kami atau jadwalkan jemput cucian sekarang!',
  },
  QUOTA_EXPIRING: {
    isEnabled: true,
    channels: ['WHATSAPP', 'IN_APP'],
    messageTemplate:
      'Halo {{customerName}}, pengingat dari {{outletName}}: Kuota paket laundry Anda tersisa {{remainingQuota}} dan akan kedaluwarsa pada {{expiryDate}}. Yuk manfaatkan sebelum hangus!',
  },
};

/**
 * Menggantikan token {{variable}} pada template pesan secara aman
 */
export function renderNotificationTemplate(
  template: string,
  variables: Record<string, string | number | undefined | null>
): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = variables[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });
}

/**
 * Mengambil daftar aturan otomasi efektif untuk tenant / outlet tertentu
 * (Merger antara DB kustom dan DEFAULT_AUTOMATION_RULES bawaan)
 */
export async function getEffectiveAutomationRules(
  tenantId: string,
  outletId?: string | null
): Promise<Array<AutomationRuleConfig & { id?: string; outletId?: string | null; isCustom: boolean }>> {
  const dbRules = await prisma.notificationAutomationRule.findMany({
    where: {
      tenantId,
      ...(outletId ? { OR: [{ outletId: null }, { outletId }] } : { outletId: null }),
    },
    orderBy: { createdAt: 'desc' },
  });

  const ruleMap = new Map<string, any>();
  // Prefer outlet-specific rule over tenant-wide (outletId: null)
  for (const r of dbRules) {
    if (!ruleMap.has(r.eventKey) || r.outletId !== null) {
      ruleMap.set(r.eventKey, r);
    }
  }

  const allKeys = Object.keys(DEFAULT_AUTOMATION_RULES) as CanonicalEventKey[];

  return allKeys.map((key) => {
    const dbRule = ruleMap.get(key);
    const def = DEFAULT_AUTOMATION_RULES[key];

    if (dbRule) {
      let channels: NotificationChannel[] = ['IN_APP', 'WHATSAPP'];
      if (Array.isArray(dbRule.channels)) {
        channels = dbRule.channels as NotificationChannel[];
      } else if (typeof dbRule.channels === 'string') {
        try {
          channels = JSON.parse(dbRule.channels);
        } catch {
          channels = def.channels;
        }
      }
      return {
        id: dbRule.id,
        outletId: dbRule.outletId,
        eventKey: key,
        isEnabled: dbRule.isEnabled,
        channels,
        messageTemplate: dbRule.messageTemplate,
        isCustom: true,
      };
    }

    return {
      eventKey: key,
      outletId: outletId || null,
      isEnabled: def.isEnabled,
      channels: def.channels,
      messageTemplate: def.messageTemplate,
      isCustom: false,
    };
  });
}

export interface DispatchDomainEventParams {
  tenantId: string;
  outletId?: string | null;
  eventKey: CanonicalEventKey | string;
  recipient: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  reference?: {
    type: 'ORDER' | 'PICKUP_REQUEST' | 'CUSTOMER' | 'SYSTEM' | string;
    id: string;
  };
  variables: Record<string, string | number | undefined | null>;
  simulateOnly?: boolean;
  messageTemplateOverride?: string | null;
  channelsOverride?: NotificationChannel[] | null;
}

/**
 * Dispatch event domain notifikasi terpusat
 */
export async function dispatchDomainEvent(params: DispatchDomainEventParams) {
  const {
    tenantId,
    outletId,
    eventKey,
    recipient,
    reference,
    variables,
    simulateOnly = false,
    messageTemplateOverride,
    channelsOverride,
  } = params;

  // 1. Ambil aturan efektif
  const effectiveRules = await getEffectiveAutomationRules(tenantId, outletId);
  const matchedRule = effectiveRules.find((r) => r.eventKey === eventKey);

  const isEnabled = matchedRule ? matchedRule.isEnabled : true;
  const rawTemplate =
    (messageTemplateOverride && messageTemplateOverride.trim() ? messageTemplateOverride : null) ||
    matchedRule?.messageTemplate ||
    (DEFAULT_AUTOMATION_RULES[eventKey as CanonicalEventKey]?.messageTemplate || 'Notifikasi dari {{outletName}}');
  const channels =
    (channelsOverride && channelsOverride.length > 0 ? channelsOverride : null) ||
    matchedRule?.channels ||
    (DEFAULT_AUTOMATION_RULES[eventKey as CanonicalEventKey]?.channels || ['IN_APP']);

  const messageBody = renderNotificationTemplate(rawTemplate, variables);

  // Jika rule dinonaktifkan (isEnabled === false)
  if (!isEnabled) {
    const skippedLog = await prisma.notificationDispatchLog.create({
      data: {
        tenantId,
        outletId: outletId || null,
        eventKey,
        channel: 'IN_APP',
        recipientName: recipient.name || null,
        recipientPhone: recipient.phone || null,
        recipientEmail: recipient.email || null,
        referenceType: reference?.type || null,
        referenceId: reference?.id || null,
        messageBody,
        status: 'SKIPPED',
        errorMessage: 'Aturan otomasi dinonaktifkan (Rule is disabled)',
        sentAt: null,
      },
    });
    return [skippedLog];
  }

  // Jika rule aktif, buat log untuk setiap kanal aktif
  const createdLogs = [];
  const now = new Date();

  for (const ch of channels) {
    let status = 'SENT';
    let errorMessage: string | null = null;
    let sentAt: Date | null = now;

    if (ch === 'WHATSAPP') {
      if (!recipient.phone) {
        status = 'FAILED';
        errorMessage = 'Nomor telepon penerima tidak ditemukan';
        sentAt = null;
      } else if (simulateOnly) {
        status = 'SENT';
        sentAt = now;
      } else {
        const waRes = await whatsAppService.sendPlainMessage({
          tenantId,
          outletId: outletId || undefined,
          targetPhone: recipient.phone,
          message: messageBody,
        });
        if (waRes.success) {
          status = 'SENT';
          sentAt = now;
        } else {
          status = 'FAILED';
          errorMessage = waRes.message || 'Gagal mengirim pesan WhatsApp';
          sentAt = null;
        }
      }
    } else if (ch === 'IN_APP') {
      status = 'SENT';
      sentAt = now;
    } else if (ch === 'EMAIL') {
      if (!recipient.email) {
        status = 'FAILED';
        errorMessage = 'Email penerima tidak ditemukan';
        sentAt = null;
      } else {
        status = 'SENT';
        sentAt = now;
      }
    }

    const logEntry = await prisma.notificationDispatchLog.create({
      data: {
        tenantId,
        outletId: outletId || null,
        eventKey,
        channel: ch,
        recipientName: recipient.name || null,
        recipientPhone: recipient.phone || null,
        recipientEmail: recipient.email || null,
        referenceType: reference?.type || null,
        referenceId: reference?.id || null,
        messageBody,
        status,
        errorMessage,
        sentAt,
      },
    });
    createdLogs.push(logEntry);
  }

  return createdLogs;
}

/**
 * Mencoba kirim ulang log notifikasi yang berstatus FAILED
 */
export async function retryDispatchLog(tenantId: string, logId: string) {
  const log = await prisma.notificationDispatchLog.findFirst({
    where: { id: logId, tenantId },
  });

  if (!log) {
    throw new Error('Log notifikasi tidak ditemukan');
  }

  const now = new Date();
  const nextRetryCount = (log.retryCount || 0) + 1;

  // Lakukan pengiriman ulang
  const updatedLog = await prisma.notificationDispatchLog.update({
    where: { id: log.id },
    data: {
      status: 'RETRIED',
      retryCount: nextRetryCount,
      errorMessage: null,
      sentAt: now,
    },
  });

  return updatedLog;
}
