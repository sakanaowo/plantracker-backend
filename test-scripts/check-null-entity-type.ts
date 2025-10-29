import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkNullEntityType() {
  try {
    console.log('Checking for activity logs with null entity_type...\n');

    // Use raw query to find null values
    const nullEntityTypeLogs = await prisma.$queryRaw<any[]>`
      SELECT id, action, entity_type, user_id, task_id, created_at
      FROM activity_logs
      WHERE entity_type IS NULL
      LIMIT 10
    `;

    console.log(`Found ${nullEntityTypeLogs.length} activity logs with null entity_type\n`);

    if (nullEntityTypeLogs.length > 0) {
      console.log('Activity logs with null entity_type:');
      nullEntityTypeLogs.forEach((log, index) => {
        console.log(`${index + 1}.`, {
          id: log.id?.substring(0, 8) + '...',
          action: log.action,
          entity_type: log.entity_type,
          user_id: log.user_id?.substring(0, 8) + '...',
          task_id: log.task_id?.substring(0, 8) + '...',
          created_at: log.created_at,
        });
      });

      console.log('\n--- Fixing: Setting entity_type to TASK for these logs ---');
      const result = await prisma.$executeRaw`
        UPDATE activity_logs
        SET entity_type = 'TASK'
        WHERE entity_type IS NULL AND task_id IS NOT NULL
      `;
      console.log(`Updated ${result} activity logs`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNullEntityType();
