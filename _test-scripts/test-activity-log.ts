// Test script to create activity log directly
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testActivityLog() {
  try {
    console.log('Testing activity log creation...');

    // Get first user
    const user = await prisma.users.findFirst();
    if (!user) {
      console.error('No user found in database');
      return;
    }

    console.log('User found:', user.id, user.email);

    // Get first workspace
    const workspace = await prisma.workspaces.findFirst();
    if (!workspace) {
      console.error('No workspace found');
      return;
    }

    console.log('Workspace found:', workspace.id, workspace.name);

    // Create test activity log
    const activityLog = await prisma.activity_logs.create({
      data: {
        workspace_id: workspace.id,
        user_id: user.id,
        action: 'CREATED',
        entity_type: 'TASK',
        entity_name: 'Test Task from Script',
      },
    });

    console.log('✅ Activity log created successfully:', activityLog.id);

    // Fetch the log back with user info
    const fetchedLog = await prisma.activity_logs.findUnique({
      where: { id: activityLog.id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
    });

    console.log('✅ Fetched log:', JSON.stringify(fetchedLog, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testActivityLog();
