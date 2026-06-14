const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const report = await prisma.importReport.findFirst({ where: { userDecision: 'interpretation_a' } });
  console.log(JSON.stringify(report, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
