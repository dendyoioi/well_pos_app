import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { catalogReadAdapter, isReadFromTargetEnabled } from '../services/read_adapters';

const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi').max(100, 'Nama kategori terlalu panjang'),
});

/**
 * Controller: Mendapatkan semua kategori beserta jumlah produk terkait
 * @route GET /api/categories
 */
export const getCategories = async (req: Request, res: Response) => {
  try {
    const { outletId, isActive, hasProductsOnly } = req.query;

    const productWhere: any = {};

    if (isActive === 'true') {
      productWhere.isActive = true;
    } else if (isActive === 'false') {
      productWhere.isActive = false;
    } else if (isActive === 'all') {
      // no isActive filter
    }

    if (outletId && typeof outletId === 'string') {
      productWhere.outletProducts = {
        some: { outletId },
      };
    }

    // Fix T1: Hapus req.query.tenantId — user input tidak boleh override konteks JWT
    let userTenantId = req.user?.tenantId || req.tenantId || (req.headers['x-tenant-id'] as string);

    if (!userTenantId && outletId && typeof outletId === 'string') {
      const outlet = await prisma.outlet.findUnique({
        where: { id: outletId },
        select: { tenantId: true },
      });
      if (outlet?.tenantId) {
        userTenantId = outlet.tenantId;
      }
    }

    if (!userTenantId) {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak: Konteks tenant tidak ditemukan',
      });
    }

    // Cutover Feature Flag (PROMPT 15.2 / PHASE 16): Switch to Target Schema Read Adapter
    if (isReadFromTargetEnabled()) {
      const categories = await catalogReadAdapter.getCategories(
        userTenantId,
        outletId as string,
        isActive as string,
        hasProductsOnly === 'true'
      );
      return res.status(200).json({
        status: 'success',
        data: categories,
      });
    }

    const categoryWhere: any = { tenantId: userTenantId };

    if (hasProductsOnly === 'true' && outletId && typeof outletId === 'string') {
      categoryWhere.products = {
        some: {
          isActive: true,
          outletProducts: {
            some: { outletId, isAvailable: true },
          },
        },
      };
    }

    const categories = await prisma.category.findMany({
      where: categoryWhere,
      include: {
        _count: {
          select: {
            products: {
              where: {
                ...productWhere,
                ...(userTenantId ? { tenantId: userTenantId } : {}),
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      status: 'success',
      data: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        productCount: cat._count.products,
        createdAt: cat.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error saat mengambil kategori:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat data kategori',
    });
  }
};

/**
 * Controller: Menambah kategori baru
 * @route POST /api/categories
 */
export const createCategory = async (req: Request, res: Response) => {
  try {
    const parseResult = categorySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name } = parseResult.data;
    let userTenantId = req.user?.tenantId || req.tenantId;
    // Fix K3: Jangan fallback ke tenant pertama di DB — return 401
    if (!userTenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    // Cek duplikasi nama kategori untuk tenant ini
    const existing = await prisma.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
    });

    if (existing) {
      return res.status(400).json({
        status: 'error',
        message: `Kategori dengan nama "${name}" sudah ada`,
      });
    }

    const newCategory = await prisma.category.create({
      data: {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        tenantId: userTenantId!,
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Kategori berhasil ditambahkan',
      data: newCategory,
    });
  } catch (error) {
    console.error('Error saat membuat kategori:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat kategori baru',
    });
  }
};

/**
 * Controller: Mengubah nama kategori
 * @route PUT /api/categories/:id
 */
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userTenantId = req.user?.tenantId;
    const parseResult = categorySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        status: 'error',
        message: 'Validasi input gagal',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { name } = parseResult.data;

    const existing = await prisma.category.findFirst({
      where: {
        id,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
    });
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Kategori tidak ditemukan',
      });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { name },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Kategori berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    console.error('Error saat update kategori:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui kategori',
    });
  }
};

/**
 * Controller: Menghapus kategori (hanya jika belum memiliki produk terhubung)
 * @route DELETE /api/categories/:id
 */
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userTenantId = req.user?.tenantId;

    const category = await prisma.category.findFirst({
      where: {
        id,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
      include: {
        _count: {
          select: {
            products: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        status: 'error',
        message: 'Kategori tidak ditemukan',
      });
    }

    if (category._count.products > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Tidak dapat menghapus kategori "${category.name}" karena masih terhubung dengan ${category._count.products} produk aktif. Silakan pindahkan produk ke kategori lain menggunakan fitur Ubah Kategori terlebih dahulu.`,
      });
    }

    // Jika produk aktif sudah 0, tetapi masih ada produk nonaktif yang terhubung (arsip):
    // Pindahkan referensi produk nonaktif tersebut ke kategori lain agar tidak melanggar foreign key restrict
    const inactiveCount = await prisma.product.count({
      where: {
        categoryId: id,
        ...(userTenantId ? { tenantId: userTenantId } : {}),
      },
    });

    if (inactiveCount > 0) {
      let fallbackCategory = await prisma.category.findFirst({
        where: {
          name: 'Lainnya',
          id: { not: id },
          ...(userTenantId ? { tenantId: userTenantId } : {}),
        },
      });

      if (!fallbackCategory) {
        fallbackCategory = await prisma.category.findFirst({
          where: {
            id: { not: id },
            ...(userTenantId ? { tenantId: userTenantId } : {}),
          },
        });
      }

      if (!fallbackCategory) {
        // Fix K3: Jika tenantId tidak ada, tolak dengan 401 daripada membuat kategori di tenant acak
        if (!userTenantId) {
          return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
        }
        fallbackCategory = await prisma.category.create({
          data: {
            name: 'Lainnya',
            slug: 'lainnya',
            tenantId: userTenantId,
          },
        });
      }

      await prisma.product.updateMany({
        where: {
          categoryId: id,
          ...(userTenantId ? { tenantId: userTenantId } : {}),
        },
        data: { categoryId: fallbackCategory.id },
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Kategori berhasil dihapus',
    });
  } catch (error) {
    console.error('Error saat hapus kategori:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus kategori',
    });
  }
};
