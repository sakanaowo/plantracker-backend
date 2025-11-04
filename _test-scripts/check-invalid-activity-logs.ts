import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInvalidActivityLogs() {
  try {
    console.log('Checking for invalid activity logs...\n');

    // Get all activity logs with raw query to see invalid data
    const result = await prisma.$queryRaw`
      SELECT id, user_id, workspace_id, project_id, board_id, task_id, 
             entity_type, action, created_at
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 20
    `;

    console.log('Recent activity logs:');
    console.log(JSON.stringify(result, null, 2));

    // Try to find specific user's logs
    console.log('\nTrying to query by user ID:');
    const userId = 'CbeoKX6oD3enstZI1PNQ9KJY7o3?limit=50'; // From the error URL
    
    // This might fail, so wrap in try-catch
    try {
      const userLogs = await prisma.activity_logs.findMany({
        where: { user_id: userId },
        take: 10,
      });
      console.log('User logs found:', userLogs.length);
    } catch (error) {
      console.log('Error querying user logs:', error.message);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInvalidActivityLogs();
