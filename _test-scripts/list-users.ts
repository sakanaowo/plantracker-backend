import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        firebase_uid: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    console.log(`Found ${users.length} users in database:\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}.`, {
        name: user.name,
        email: user.email,
        firebase_uid: user.firebase_uid,
        db_id: user.id.substring(0, 8) + '...',
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
