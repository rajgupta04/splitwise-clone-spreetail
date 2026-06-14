const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const flags = await prisma.anomalyFlag.findMany({ where: { anomalyType: 'name_mismatch' } });
  console.log(JSON.stringify(flags, null, 2));
}

main().finally(() => prisma.$disconnect());
