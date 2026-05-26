import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Example data can be added here
  // const user = await prisma.user.create({
  //   data: {
  //     telegramId: '123456789',
  //     firstName: 'John',
  //     lastName: 'Doe',
  //   },
  // });

  console.log('✅ Seeding completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
