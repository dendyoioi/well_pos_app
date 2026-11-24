import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getLaundryServices,
  createLaundryService,
  updateLaundryService,
  deleteLaundryService,
  getLaundryServiceBom,
  saveLaundryServiceBom,
  getLaundryRacks,
  createLaundryRack,
  getLaundryOrders,
  createLaundryOrder,
  updateLaundryStatus,
  sendLaundryWhatsApp,
  getLaundryManifests,
  createLaundryManifest,
  receiveLaundryManifest,
  getAvailableOrdersForManifest,
  getLaundryWorkshops,
  toggleOutletWorkshopMode,
  advanceLaundryStage,
  getOrderStageLogs,
  getProductionKpiReport,
  getLaundryStageSettings,
  updateLaundryStageSettings,
  resetLaundryStageSettings,
  saveLaundrySortingData,
  getPublicLaundryTracking,
  uploadLaundryConditionPhoto,
  getCustomerLaundryWallet,
  topupCustomerLaundryWallet,
  getLaundryDepositConfig,
  updateLaundryDepositConfig,
  getLaundryDeliveryConfig,
  updateLaundryDeliveryConfig,
  getLaundryDeliveries,
  updateLaundryDeliveryStatus,
  rewashLaundryOrder,
  getLaundryCommissionConfig,
  updateLaundryCommissionConfig,
  getLaundryCommissions,
  payoutLaundryCommission,
  getStaffCashAdvances,
  createStaffCashAdvance,
  repayStaffCashAdvance,
  executeLaundryAutoReminders,
  getLaundryDashboardSummary,
  submitPublicLaundryFeedback,
  trackGoogleReviewClick,
  getLaundryFeedbacks,
  resolveLaundryFeedback,
  getDormantLaundryCustomers,
  sendCustomerWinback,
} from '../controllers/laundry.controller';

const router = Router();

// --- 0. Endpoint Publik Tanpa Autentikasi (Live QR Tracking & Feedback Pelanggan) ---
router.get('/public/track/:invoiceNumber', getPublicLaundryTracking);
router.post('/public/track/:invoiceNumber/feedback', submitPublicLaundryFeedback);
router.patch('/public/track/:invoiceNumber/feedback/google-click', trackGoogleReviewClick);

// Proteksi seluruh endpoint operasional di bawah ini dengan Autentikasi & Multi-Tenant Isolation
router.use(authenticate);

// --- Smart Role-Based Laundry Dashboard Summary ---
router.get('/dashboard-summary', getLaundryDashboardSummary);

// --- Master Pengaturan Tahapan Produksi (Owner Custom Stages) ---
router.get('/stage-settings', getLaundryStageSettings);
router.put('/stage-settings', updateLaundryStageSettings);
router.post('/stage-settings/reset', resetLaundryStageSettings);

// --- Master Layanan & Tarif Laundry ---
router.get('/services', getLaundryServices);
router.post('/services', createLaundryService);
router.get('/services/:id/bom', getLaundryServiceBom);
router.put('/services/:id/bom', saveLaundryServiceBom);
router.put('/services/:id', updateLaundryService);
router.delete('/services/:id', deleteLaundryService);

// --- Master Rak & Titik Simpan Laundry ---
router.get('/racks', getLaundryRacks);
router.post('/racks', createLaundryRack);

// --- Operasional Antrean & Transaksi Laundry ---
router.get('/orders', getLaundryOrders);
router.post('/orders', createLaundryOrder);
router.patch('/orders/:id/status', updateLaundryStatus);
router.post('/orders/:id/send-whatsapp', sendLaundryWhatsApp);
router.post('/orders/:id/rewash', rewashLaundryOrder);

// --- Modul Sortir Pakaian & Bukti Foto Kondisi Anti-Komplain ---
router.post('/upload-photo', uploadLaundryConditionPhoto);
router.post('/orders/:id/sort', saveLaundrySortingData);

// --- Dompet Laundry Pelanggan (Deposit Saldo & Kuota Kiloan) ---
router.get('/customers/:customerId/wallet', getCustomerLaundryWallet);
router.post('/customers/:customerId/wallet/topup', topupCustomerLaundryWallet);
router.get('/deposit-config', getLaundryDepositConfig);
router.put('/deposit-config', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateLaundryDepositConfig);

// --- Modul Delivery Pelanggan & Ongkir Otomatis ---
router.get('/delivery-config', getLaundryDeliveryConfig);
router.put('/delivery-config', updateLaundryDeliveryConfig);
router.get('/deliveries', getLaundryDeliveries);
router.patch('/deliveries/:orderId/status', updateLaundryDeliveryStatus);

// --- Sistem Tahapan Produksi & Audit Trail Operator ---
router.post('/orders/:id/advance-stage', advanceLaundryStage);
router.get('/orders/:id/stage-logs', getOrderStageLogs);
router.get('/production-kpi', getProductionKpiReport);

// --- Multi-Cabang & Mode Workshop (Surat Jalan Manifest) ---
router.get('/manifests', getLaundryManifests);
router.post('/manifests', createLaundryManifest);
router.post('/manifests/:id/receive', receiveLaundryManifest);
router.get('/manifests/available-orders', getAvailableOrdersForManifest);
router.get('/workshops', getLaundryWorkshops);
router.patch('/workshops/:id/toggle', toggleOutletWorkshopMode);

// --- Modul Komisi Otomatis Staf Produksi & Kurir ---
router.get('/commission-config', getLaundryCommissionConfig);
router.put('/commission-config', updateLaundryCommissionConfig);
router.get('/commissions', getLaundryCommissions);
router.post('/commissions/payout', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), payoutLaundryCommission);

// --- Modul Kasbon Karyawan & Auto-Reminder WA (P2) ---
router.get('/cash-advances', getStaffCashAdvances);
router.post('/cash-advances', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), createStaffCashAdvance);
router.patch('/cash-advances/:id/repay', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), repayStaffCashAdvance);
router.post('/reminders/run', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), executeLaundryAutoReminders);

// --- Modul Rating, Feedback & Komplain Pelanggan (Fase A) ---
router.get('/feedbacks', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), getLaundryFeedbacks);
router.patch('/feedbacks/:id/resolve', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), resolveLaundryFeedback);

// --- Modul Pelanggan Pasif & Sapaan Win-Back WA (Fase A) ---
router.get('/customers/dormant', getDormantLaundryCustomers);
router.post('/customers/:customerId/send-winback', sendCustomerWinback);

export { router as laundryRouter };
