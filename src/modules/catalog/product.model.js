import prisma from "../../config/prisma.js";

const publicProductSelect = {
  id: true,
  name: true,
  description: true,
  priceAmount: true,
  currency: true,
  stockOnHand: true,
  stockReserved: true,
  createdAt: true,
  publishedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  vendor: {
    select: {
      id: true,
      businessName: true,
      slug: true,
    },
  },
  images: {
    select: {
      url: true,
      altText: true,
      position: true,
    },
    orderBy: { position: "asc" },
  },
};

const publicVisibility = {
  status: "ACTIVE",
  isAvailable: true,
  category: { isActive: true },
  vendor: { status: "ACTIVE" },
};

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildWhere(filters) {
  const where = { ...publicVisibility };

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { vendor: { businessName: { contains: filters.q, mode: "insensitive" } } },
      { category: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  if (filters.category) {
    where.category = isUuid(filters.category)
      ? { isActive: true, id: filters.category }
      : { isActive: true, slug: filters.category };
  }

  if (filters.vendor) {
    where.vendor = isUuid(filters.vendor)
      ? { status: "ACTIVE", id: filters.vendor }
      : { status: "ACTIVE", slug: filters.vendor };
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.priceAmount = {};
    if (filters.minPrice !== undefined) where.priceAmount.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) where.priceAmount.lte = filters.maxPrice;
  }

  if (filters.inStock === true) {
    where.stockOnHand = { gt: 0 };
  }

  if (filters.inStock === false) {
    where.stockOnHand = { lte: 0 };
  }

  return where;
}

function orderByFor(sort) {
  if (sort === "price_asc") return [{ priceAmount: "asc" }, { id: "asc" }];
  if (sort === "price_desc") return [{ priceAmount: "desc" }, { id: "asc" }];
  return [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }];
}

export function findPublicProducts(filters) {
  const where = buildWhere(filters);
  const pageSize = filters.pageSize ?? filters.pagesize ?? 20;
  const skip = (filters.page - 1) * pageSize;

  return prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: publicProductSelect,
      orderBy: orderByFor(filters.sort),
      skip,
      take: pageSize,
    }),
  ]);
}

export function findPublicProductById(id) {
  return prisma.product.findFirst({
    where: {
      id,
      ...publicVisibility,
    },
    select: publicProductSelect,
  });
}
