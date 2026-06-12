const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...\n');

  // Create demo users
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash('password123', salt);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: { email: 'alice@example.com', name: 'Alice Johnson', passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: { email: 'bob@example.com', name: 'Bob Smith', passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'charlie@example.com' },
      update: {},
      create: { email: 'charlie@example.com', name: 'Charlie Brown', passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'diana@example.com' },
      update: {},
      create: { email: 'diana@example.com', name: 'Diana Prince', passwordHash },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);
  users.forEach((u) => console.log(`   - ${u.name} (${u.email})`));

  // Create a demo group
  const group = await prisma.group.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Roommates',
      description: 'Monthly shared expenses',
      baseCurrency: 'USD',
      createdById: users[0].id,
    },
  });

  console.log(`\n✅ Created group: ${group.name}`);

  // Add all users as members
  for (const user of users) {
    await prisma.groupMembership.upsert({
      where: {
        groupId_userId_joinedAt: {
          groupId: group.id,
          userId: user.id,
          joinedAt: new Date('2024-01-01'),
        },
      },
      update: {},
      create: {
        groupId: group.id,
        userId: user.id,
        joinedAt: new Date('2024-01-01'),
        status: 'active',
      },
    });
  }

  console.log(`✅ Added ${users.length} members to ${group.name}`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Login credentials for all users:');
  console.log('   Email: alice@example.com / bob@example.com / charlie@example.com / diana@example.com');
  console.log('   Password: password123\n');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
