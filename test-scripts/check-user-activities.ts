import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserActivities() {
  try {
    // Tìm user với Firebase UID từ screenshot
    const FIREBASE_UID = 'CbeoKX6oD3enstZI1PNQ9KJY7o3';
    
    console.log('Looking for user with Firebase UID:', FIREBASE_UID);
    
    const user = await prisma.users.findUnique({
      where: { firebase_uid: FIREBASE_UID },
      select: {
        id: true,
        name: true,
        email: true,
        firebase_uid: true,
      },
    });

    if (!user) {
      console.log('❌ User not found in database!');
      return;
    }

    console.log('\n✅ User found:');
    console.log(JSON.stringify(user, null, 2));

    // Kiểm tra activity logs của user này
    console.log('\n--- Checking activity logs ---');
    const activityLogs = await prisma.activity_logs.findMany({
      where: { user_id: user.id },
      include: {
        users: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    console.log(`\nFound ${activityLogs.length} activity logs for this user\n`);

    if (activityLogs.length > 0) {
      activityLogs.forEach((log, index) => {
        console.log(`${index + 1}.`, {
          action: log.action,
          entityType: log.entity_type,
          workspaceId: log.workspace_id?.substring(0, 8) + '...',
          projectId: log.project_id?.substring(0, 8) + '...',
          boardId: log.board_id?.substring(0, 8) + '...',
          createdAt: log.created_at,
        });
      });
    } else {
      console.log('⚠️  No activity logs found for this user');
      console.log('User needs to perform actions (create task, update task, etc.) to generate activity logs');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserActivities();
