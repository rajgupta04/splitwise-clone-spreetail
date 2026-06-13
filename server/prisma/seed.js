const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...\n');

  console.log('🧹 Cleaning up existing database...');
  await prisma.activityLog.deleteMany({});
  await prisma.anomalyFlag.deleteMany({});
  await prisma.importDecision.deleteMany({});
  await prisma.importItem.deleteMany({});
  await prisma.csvImport.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.expenseSplit.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.groupMembership.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✅ Database cleaned up.');

  // Create demo users
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('Password123!', salt);

  const usersData = [
    { name: 'Aisha', email: 'aisha@example.com' },
    { name: 'Rohan', email: 'rohan@example.com' },
    { name: 'Priya', email: 'priya@example.com' },
    { name: 'Meera', email: 'meera@example.com' },
    { name: 'Sam', email: 'sam@example.com' },
    { name: 'Dev', email: 'dev@example.com' },
  ];

  const users = {};
  for (const u of usersData) {
    users[u.name.toLowerCase()] = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash,
      },
    });
  }

  console.log(`✅ Created ${Object.keys(users).length} users`);
  Object.values(users).forEach((u) => console.log(`   - ${u.name} (${u.email})`));

  // Create Flatmates group
  const group = await prisma.group.create({
    data: {
      name: 'Flatmates',
      description: 'Shared expenses for the apartment',
      baseCurrency: 'USD',
      createdById: users.aisha.id,
    },
  });

  console.log(`\n✅ Created group: ${group.name}`);

  // Create memberships with timeline
  const membershipsData = [
    { name: 'aisha', joinedAt: new Date('2025-02-01'), leftAt: null, status: 'active' },
    { name: 'rohan', joinedAt: new Date('2025-02-01'), leftAt: null, status: 'active' },
    { name: 'priya', joinedAt: new Date('2025-02-01'), leftAt: null, status: 'active' },
    { name: 'meera', joinedAt: new Date('2025-02-01'), leftAt: new Date('2025-03-31'), status: 'inactive' },
    { name: 'sam', joinedAt: new Date('2025-04-15'), leftAt: null, status: 'active' },
    { name: 'dev', joinedAt: new Date('2025-05-01'), leftAt: null, status: 'active' },
  ];

  for (const m of membershipsData) {
    const user = users[m.name];
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId: user.id,
        joinedAt: m.joinedAt,
        leftAt: m.leftAt,
        status: m.status,
      },
    });
  }

  console.log(`✅ Added members with timeline to ${group.name}`);

  // 1. Equal split expense
  // Date: 2025-02-15 (Aisha, Rohan, Priya, Meera active)
  // Groceries & Supplies: 120 USD (30 USD each)
  const equalExpense = await prisma.expense.create({
    data: {
      groupId: group.id,
      paidById: users.aisha.id,
      description: 'Groceries & Supplies',
      originalAmount: 120.00,
      originalCurrency: 'USD',
      exchangeRate: 1.000000,
      normalizedAmount: 120.00,
      splitType: 'equal',
      expenseDate: new Date('2025-02-15'),
      createdById: users.aisha.id,
      splits: {
        create: [
          { userId: users.aisha.id, originalAmount: 30.00, normalizedAmount: 30.00 },
          { userId: users.rohan.id, originalAmount: 30.00, normalizedAmount: 30.00 },
          { userId: users.priya.id, originalAmount: 30.00, normalizedAmount: 30.00 },
          { userId: users.meera.id, originalAmount: 30.00, normalizedAmount: 30.00 },
        ],
      },
    },
  });
  console.log(`✅ Created equal split expense: "${equalExpense.description}" ($120.00)`);

  // 2. Percentage split expense
  // Date: 2025-03-10 (Aisha, Rohan, Priya, Meera active)
  // Broadband Internet: 200 USD (Rohan 40% = 80 USD, Aisha 30% = 60 USD, Priya 30% = 60 USD)
  const percentageExpense = await prisma.expense.create({
    data: {
      groupId: group.id,
      paidById: users.rohan.id,
      description: 'Broadband Internet',
      originalAmount: 200.00,
      originalCurrency: 'USD',
      exchangeRate: 1.000000,
      normalizedAmount: 200.00,
      splitType: 'percentage',
      expenseDate: new Date('2025-03-10'),
      createdById: users.rohan.id,
      splits: {
        create: [
          { userId: users.rohan.id, originalAmount: 80.00, normalizedAmount: 80.00, percentage: 40.00 },
          { userId: users.aisha.id, originalAmount: 60.00, normalizedAmount: 60.00, percentage: 30.00 },
          { userId: users.priya.id, originalAmount: 60.00, normalizedAmount: 60.00, percentage: 30.00 },
        ],
      },
    },
  });
  console.log(`✅ Created percentage split expense: "${percentageExpense.description}" ($200.00)`);

  // 3. Shares split expense
  // Date: 2025-04-20 (Aisha, Rohan, Priya, Sam active; Meera left, Dev not yet joined)
  // Electricity Bill: 100 USD (Priya 2 shares = 50 USD, Aisha 1 share = 25 USD, Sam 1 share = 25 USD)
  const sharesExpense = await prisma.expense.create({
    data: {
      groupId: group.id,
      paidById: users.priya.id,
      description: 'Electricity Bill',
      originalAmount: 100.00,
      originalCurrency: 'USD',
      exchangeRate: 1.000000,
      normalizedAmount: 100.00,
      splitType: 'shares',
      expenseDate: new Date('2025-04-20'),
      createdById: users.priya.id,
      splits: {
        create: [
          { userId: users.priya.id, originalAmount: 50.00, normalizedAmount: 50.00, shares: 2 },
          { userId: users.aisha.id, originalAmount: 25.00, normalizedAmount: 25.00, shares: 1 },
          { userId: users.sam.id, originalAmount: 25.00, normalizedAmount: 25.00, shares: 1 },
        ],
      },
    },
  });
  console.log(`✅ Created shares split expense: "${sharesExpense.description}" ($100.00)`);

  // 4. Settlement
  // Date: 2025-03-15
  // Rohan pays Aisha 50 USD
  const settlement = await prisma.settlement.create({
    data: {
      groupId: group.id,
      payerId: users.rohan.id,
      payeeId: users.aisha.id,
      originalAmount: 50.00,
      originalCurrency: 'USD',
      exchangeRate: 1.000000,
      normalizedAmount: 50.00,
      settledAt: new Date('2025-03-15'),
      createdById: users.rohan.id,
    },
  });
  console.log(`✅ Created settlement: Rohan paid Aisha $50.00`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Login credentials for all users:');
  console.log('   Emails: aisha@example.com, rohan@example.com, priya@example.com, meera@example.com, sam@example.com, dev@example.com');
  console.log('   Password: Password123!\n');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
