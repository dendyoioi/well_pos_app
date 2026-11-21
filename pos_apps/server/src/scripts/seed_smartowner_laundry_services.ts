import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function categorize(name: string, unit: string): string {
  const n = name.toLowerCase();
  const u = (unit || '').toUpperCase();
  if (u === 'KG') return 'KILOAN';
  if (
    n.includes('sepatu') ||
    n.includes('sandal') ||
    n.includes('tas ') ||
    n.includes('tas-') ||
    n.includes('ransel') ||
    n.includes('koper') ||
    n.includes('helm')
  ) {
    return 'SEPATU_TAS';
  }
  if (
    n.includes('bedcover') ||
    n.includes('sprei') ||
    n.includes('selimut') ||
    n.includes('bantal') ||
    n.includes('guling') ||
    n.includes('matras') ||
    n.includes('kasur') ||
    n.includes('playmate')
  ) {
    return 'BEDDING';
  }
  if (
    n.includes('karpet') ||
    n.includes('gorden') ||
    n.includes('vitrase') ||
    n.includes('taplak')
  ) {
    return 'GORDEN_KARPET';
  }
  if (
    n.includes('boneka') ||
    n.includes('stroller') ||
    n.includes('baby') ||
    n.includes('gendongan') ||
    n.includes('bouncher')
  ) {
    return 'BONEKA_BABY';
  }
  if (
    n.includes('parfum') ||
    n.includes('deterjen') ||
    n.includes('plastik') ||
    n.includes('hanger') ||
    n.includes('noda')
  ) {
    return 'ADDON';
  }
  return 'PAKAIAN_SATUAN';
}

async function main() {
  console.log('🧺 Memulai sinkronisasi 154 Layanan SmartOwner ke Database Well POS...');

  const jsonPath = path.join(__dirname, '../../smartlink_services.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`File ${jsonPath} tidak ditemukan`);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const json = JSON.parse(raw);
  const items = json.data || [];

  console.log(`Ditemukan ${items.length} item layanan mentah dari SmartOwner.`);

  // Temukan tenant laundry (Wellhouse Corporation)
  const laundryTenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { id: 'b39e9b27-fecb-4404-afb8-a200f01e0a73' },
        { name: { contains: 'Wellhouse', mode: 'insensitive' } },
        { businessType: { contains: 'LAUNDRY', mode: 'insensitive' } },
      ],
    },
  });

  if (!laundryTenant) {
    throw new Error('Tenant Laundry tidak ditemukan!');
  }

  console.log(`Menggunakan Tenant: ${laundryTenant.name} (${laundryTenant.id})`);

  // Hapus layanan lama pada tenant ini agar tersinkronisasi bersih
  const deleted = await prisma.laundryService.deleteMany({
    where: { tenantId: laundryTenant.id },
  });
  console.log(`Membersihkan ${deleted.count} data layanan lama...`);

  let insertedCount = 0;

  for (const item of items) {
    const rawName = item.layanan?.nama_layanan || '';
    const name = rawName.trim();
    if (!name) continue;

    const rawUnit = item.layanan?.satuan?.nama || 'PCS';
    let unit = 'Pcs';
    if (rawUnit.toUpperCase() === 'KG') unit = 'Kg';
    else if (rawUnit.toUpperCase() === 'STEL') unit = 'Stel';
    else if (rawUnit.toUpperCase() === 'LEMBAR') unit = 'Lembar';
    else if (rawUnit.toUpperCase() === 'PCS') unit = 'Pcs';

    const category = categorize(name, rawUnit);
    const durasiMs = item.layanan?.durasi_penyelesaian || 48 * 3600 * 1000;
    const durationHours = Math.round(durasiMs / (1000 * 3600)) || 24;
    const price = new Prisma.Decimal(item.harga || 0);
    const minOrderQty = new Prisma.Decimal(item.min_order_reg || 0);

    await prisma.laundryService.create({
      data: {
        tenantId: laundryTenant.id,
        name,
        category,
        unit,
        price,
        minOrderQty,
        durationHours,
        expressMultiplier: new Prisma.Decimal(1.0),
        description: `Layanan ${name} resmi dari katalog WellHouse Laundry (Durasi: ${durationHours} jam, satuan ${unit})`,
        isActive: true,
      },
    });

    insertedCount++;
  }

  // Tambahkan 4 Add-on Treatment Standar
  const standardAddons = [
    {
      name: 'Hilangkan Noda Membandel (Spotting)',
      category: 'ADDON',
      unit: 'FLAT',
      price: new Prisma.Decimal(10000),
      minOrderQty: new Prisma.Decimal(1),
      durationHours: 0,
      description: 'Treatment cairan khusus untuk noda darah, getah, tinta, karat, atau jamur.',
    },
    {
      name: 'Parfum Sultan Premium (Grade A)',
      category: 'ADDON',
      unit: 'PER_KG',
      price: new Prisma.Decimal(2500),
      minOrderQty: new Prisma.Decimal(1),
      durationHours: 0,
      description: 'Parfum konsentrat mewah wangi tahan lama hingga 14 hari.',
    },
    {
      name: 'Anti-Bakteri & Sanitasi Higienis',
      category: 'ADDON',
      unit: 'PER_KG',
      price: new Prisma.Decimal(2000),
      minOrderQty: new Prisma.Decimal(1),
      durationHours: 0,
      description: 'Sanitasi disinfektan higienis membunuh 99.9% kuman dan tungau pakaian.',
    },
    {
      name: 'Hanger Jas & Plastik Pelindung',
      category: 'ADDON',
      unit: 'FLAT',
      price: new Prisma.Decimal(3500),
      minOrderQty: new Prisma.Decimal(1),
      durationHours: 0,
      description: 'Gantungan baju kokoh dan kantong plastik pelindung debu.',
    },
  ];

  for (const addon of standardAddons) {
    await prisma.laundryService.create({
      data: {
        ...addon,
        tenantId: laundryTenant.id,
        expressMultiplier: new Prisma.Decimal(1.0),
        isActive: true,
      },
    });
    insertedCount++;
  }

  console.log(`✅ Sukses menyinkronkan total ${insertedCount} layanan (${items.length} layanan SmartOwner + 4 Add-on treatment)!`);
}

main()
  .catch((e) => {
    console.error('❌ Gagal sinkronisasi layanan:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
