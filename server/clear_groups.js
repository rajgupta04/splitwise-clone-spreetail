const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.group.findMany({ where: { name: 'Mock Test Group (INR)' } });
  const groupIds = groups.map(g => g.id);
  
  if (groupIds.length > 0) {
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."anomaly_flags" WHERE import_item_id IN (SELECT id FROM "public"."import_items" WHERE import_id IN (SELECT id FROM "public"."csv_imports" WHERE group_id = ANY($1)))`, groupIds);
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."import_decisions" WHERE import_item_id IN (SELECT id FROM "public"."import_items" WHERE import_id IN (SELECT id FROM "public"."csv_imports" WHERE group_id = ANY($1)))`, groupIds);
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."import_reports" WHERE import_id IN (SELECT id FROM "public"."csv_imports" WHERE group_id = ANY($1))`, groupIds);
    
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."expense_splits" WHERE expense_id IN (SELECT id FROM "public"."expenses" WHERE group_id = ANY($1))`, groupIds);
    
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."expenses" WHERE group_id = ANY($1)`, groupIds);
    
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."import_items" WHERE import_id IN (SELECT id FROM "public"."csv_imports" WHERE group_id = ANY($1))`, groupIds);
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."csv_imports" WHERE group_id = ANY($1)`, groupIds);
    
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."settlements" WHERE group_id = ANY($1)`, groupIds);
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."activity_logs" WHERE entity_id = ANY($1::text[])`, groupIds);
    
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."group_memberships" WHERE group_id = ANY($1)`, groupIds);
    await prisma.$executeRawUnsafe(`DELETE FROM "public"."groups" WHERE id = ANY($1)`, groupIds);
  }
  
  console.log('Deleted ' + groupIds.length + ' mock groups');
}

main().catch(console.error).finally(() => prisma.$disconnect());
