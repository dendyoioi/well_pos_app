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
  updateLaundryRack,
  deleteLaundryRack,
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
  getLaundryPerfumes,
  createLaundryPerfume,
  updateLaundryPerfume,
  deleteLaundryPerfume,
  getLaundryMachines,
  createLaundryMachine,
  updateLaundryMachine,
  deleteLaundryMachine,
  createLaundryIncident,
  getLaundryIncidents,
  updateLaundryIncident,
  generateLaundryIncidentClaimToken,
  settleLaundryIncident,
  getPublicIncidentClaim,
  uploadPublicIncidentClaimPhoto,
  submitPublicIncidentClaimEvidence,
  getStaffPerformance,
  createStaffPerformanceReview,
  getStaffPerformanceReviews,
  getLaundryCategories,
  updateLaundryCategories,
  reassignLaundryCategory,
  deleteLaundryCategory,
} from '../controllers/laundry.controller';

const router = Router();

// --- 0. Endpoint Publik Tanpa Autentikasi (Live QR Tracking, Feedback & Klaim Bukti Insiden Pelanggan) ---
router.get('/public/track/:invoiceNumber', getPublicLaundryTracking);
router.post('/public/track/:invoiceNumber/feedback', submitPublicLaundryFeedback);
router.patch('/public/track/:invoiceNumber/feedback/google-click', trackGoogleReviewClick);
router.get('/public/incident-claim/:token', getPublicIncidentClaim);
router.post('/public/incident-claim/:token/photo', uploadPublicIncidentClaimPhoto);
router.post('/public/incident-claim/:token/evidence', submitPublicIncidentClaimEvidence);

// Proteksi seluruh endpoint operasional di bawah ini dengan Autentikasi & Multi-Tenant Isolation
router.use(authenticate);

// --- Smart Role-Based Laundry Dashboard Summary ---
router.get('/dashboard-summary', getLaundryDashboardSummary);

// --- Master Pengaturan Tahapan Produksi (Owner Custom Stages) ---
router.get('/stage-settings', getLaundryStageSettings);
router.put('/stage-settings', updateLaundryStageSettings);
router.post('/stage-settings/reset', resetLaundryStageSettings);

// --- Master Layanan & Tarif Laundry ---
router.get('/categories', getLaundryCategories);
router.put('/categories', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateLaundryCategories);
router.post('/categories/reassign', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), reassignLaundryCategory);
router.delete('/categories/:categoryKey', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), deleteLaundryCategory);
router.get('/services', getLaundryServices);
router.post('/services', createLaundryService);
router.get('/services/:id/bom', getLaundryServiceBom);
router.put('/services/:id/bom', saveLaundryServiceBom);
router.put('/services/:id', updateLaundryService);
router.delete('/services/:id', deleteLaundryService);

// --- Master Varian Parfum & Takaran BoM ---
router.get('/perfumes', getLaundryPerfumes);
router.post('/perfumes', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), createLaundryPerfume);
router.put('/perfumes/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateLaundryPerfume);
router.delete('/perfumes/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), deleteLaundryPerfume);

// --- Master Rak & Titik Simpan Laundry ---
router.get('/racks', getLaundryRacks);
router.post('/racks', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), createLaundryRack);
router.put('/racks/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateLaundryRack);
router.patch('/racks/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateLaundryRack);
router.delete('/racks/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), deleteLaundryRack);

// --- Master Mesin Produksi Laundry (Washer & Dryer) ---
router.get('/machines', getLaundryMachines);
router.post('/machines', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), createLaundryMachine);
router.patch('/machines/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateLaundryMachine);
router.delete('/machines/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), deleteLaundryMachine);

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
router.get('/wallet/:customerId', getCustomerLaundryWallet);
router.post('/wallet/:customerId/topup', topupCustomerLaundryWallet);
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

// --- Modul Manajemen Insiden Pakaian Rusak / Hilang (Fase B & Penyelesaian Terpadu) ---
router.post('/incidents', createLaundryIncident);
router.get('/incidents', getLaundryIncidents);
router.post('/incidents/:id/claim-token', generateLaundryIncidentClaimToken);
router.post('/incidents/:id/settle', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), settleLaundryIncident);
router.patch('/incidents/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateLaundryIncident);

// --- Modul Evaluasi Performa Karyawan (Fase B) ---
router.get('/staff-performance', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), getStaffPerformance);
router.post('/staff-performance/reviews', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), createStaffPerformanceReview);
router.post('/performance-reviews', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), createStaffPerformanceReview);
router.get('/staff-performance/reviews', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), getStaffPerformanceReviews);
router.get('/performance-reviews', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), getStaffPerformanceReviews);

export { router as laundryRouter };
