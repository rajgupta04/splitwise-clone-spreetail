const prisma = require('../../config/database');

/**
 * Imports repository — data access for CSV imports and import items.
 */
const importsRepository = {
  async createImport(data) {
    return prisma.csvImport.create({
      data,
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true, baseCurrency: true } },
      },
    });
  },

  async findById(id) {
    return prisma.csvImport.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true, baseCurrency: true } },
        _count: { select: { items: true } },
      },
    });
  },

  async findByGroupId(groupId) {
    return prisma.csvImport.findMany({
      where: { groupId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async updateStatus(id, data) {
    return prisma.csvImport.update({
      where: { id },
      data,
    });
  },

  async createImportItem(data) {
    return prisma.importItem.create({ data });
  },

  async createManyImportItems(items) {
    return prisma.importItem.createMany({ data: items });
  },

  async findItemsByImportId(importId, { status } = {}) {
    const where = { importId };
    if (status) where.status = status;

    return prisma.importItem.findMany({
      where,
      include: {
        anomalyFlags: true,
        decisions: {
          include: { decidedBy: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { rowNumber: 'asc' },
    });
  },

  async findItemById(id) {
    return prisma.importItem.findUnique({
      where: { id },
      include: {
        anomalyFlags: true,
        decisions: {
          include: { decidedBy: { select: { id: true, name: true, email: true } } },
        },
        csvImport: { select: { id: true, uploadedById: true, groupId: true, status: true } },
      },
    });
  },

  async updateItemStatus(id, status) {
    return prisma.importItem.update({
      where: { id },
      data: { status },
    });
  },

  async createAnomalyFlag(data) {
    return prisma.anomalyFlag.create({ data });
  },

  async createDecision(data) {
    return prisma.importDecision.create({
      data,
      include: { decidedBy: { select: { id: true, name: true, email: true } } },
    });
  },

  async getDecisionsByImportId(importId) {
    return prisma.importDecision.findMany({
      where: { importItem: { importId } },
      include: {
        decidedBy: { select: { id: true, name: true, email: true } },
        importItem: { select: { id: true, rowNumber: true, status: true } },
      },
      orderBy: { decidedAt: 'desc' },
    });
  },
};

module.exports = importsRepository;
