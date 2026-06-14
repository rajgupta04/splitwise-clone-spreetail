const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing CSV import data...');
  
  // Unlink expenses from import items so we can delete the items
  await prisma.expense.updateMany({ 
    where: { importItemId: { not: null } },
    data: { importItemId: null } 
  });
  console.log('Unlinked expenses.');

  // Delete child records first
  await prisma.anomalyFlag.deleteMany({});
  await prisma.importDecision.deleteMany({});
  await prisma.importReport.deleteMany({});
  console.log('Deleted anomaly flags, decisions, and reports.');

  // Delete import items and imports
  await prisma.importItem.deleteMany({});
  console.log('Deleted import items.');
  
  await prisma.csvImport.deleteMany({});
  console.log('Deleted CSV imports.');

  console.log('Successfully cleared all CSV import data!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
