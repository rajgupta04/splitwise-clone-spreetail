const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 

async function main() {
  const counts = await prisma.importItem.groupBy({ by: ['importStatus'], _count: { id: true } });
  console.log(counts);
}

main().finally(() => prisma.$disconnect());
