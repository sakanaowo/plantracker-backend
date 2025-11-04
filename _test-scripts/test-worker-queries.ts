/**
 * Mock Worker Service Test
 * Test worker logic without actual FCM/Firebase
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testUpcomingTasksQuery() {
  console.log('\n========================================');
  console.log('TEST 1: Query Upcoming Tasks (Due within 24h)');
  console.log('========================================\n');

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    const upcomingTasks = await prisma.tasks.findMany({
      where: {
        due_at: {
          gte: now,
          lte: tomorrow,
        },
        status: {
          not: 'DONE',
        },
        deleted_at: null,
      },
      include: {
        task_assignees: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                user_devices: {
                  where: {
                    is_active: true,
                  },
                  select: {
                    fcm_token: true,
                    platform: true,
                  },
                  take: 1,
                },
              },
            },
          },
        },
        projects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`✅ Found ${upcomingTasks.length} upcoming tasks`);

    if (upcomingTasks.length > 0) {
      console.log('\nSample tasks:');
      upcomingTasks.slice(0, 3).forEach((task, index) => {
        console.log(`\n${index + 1}. Task: ${task.title}`);
        console.log(`   Due: ${task.due_at}`);
        console.log(`   Project: ${task.projects.name}`);
        console.log(
          `   Assignee: ${task.users_tasks_assignee_idTousers?.name || 'Unassigned'}`,
        );
        console.log(
          `   Has FCM Token: ${task.users_tasks_assignee_idTousers?.user_devices?.[0]?.fcm_token ? '✅' : '❌'}`,
        );
      });
    } else {
      console.log(
        'ℹ️  No upcoming tasks found. This is OK if no tasks are due soon.',
      );
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testOverdueTasksQuery() {
  console.log('\n========================================');
  console.log('TEST 2: Query Overdue Tasks');
  console.log('========================================\n');

  const now = new Date();

  try {
    const overdueTasks = await prisma.tasks.findMany({
      where: {
        due_at: {
          lt: now,
        },
        status: {
          not: 'DONE',
        },
        deleted_at: null,
      },
      include: {
        users_tasks_assignee_idTousers: {
          select: {
            id: true,
            name: true,
            user_devices: {
              where: {
                is_active: true,
              },
              select: {
                fcm_token: true,
              },
              take: 1,
            },
          },
        },
        projects: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log(`✅ Found ${overdueTasks.length} overdue tasks`);

    if (overdueTasks.length > 0) {
      console.log('\nSample overdue tasks:');
      overdueTasks.slice(0, 3).forEach((task, index) => {
        const daysOverdue = Math.floor(
          (now.getTime() - (task.due_at?.getTime() || 0)) /
            (1000 * 60 * 60 * 24),
        );
        console.log(`\n${index + 1}. Task: ${task.title}`);
        console.log(`   Due: ${task.due_at}`);
        console.log(`   Overdue by: ${daysOverdue} days`);
        console.log(
          `   Assignee: ${task.users_tasks_assignee_idTousers?.name || 'Unassigned'}`,
        );
      });
    } else {
      console.log('ℹ️  No overdue tasks found. Great job!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testUsersWithActiveTasksQuery() {
  console.log('\n========================================');
  console.log('TEST 3: Query Users with Active Tasks');
  console.log('========================================\n');

  try {
    const usersWithTasks = await prisma.users.findMany({
      where: {
        user_devices: {
          some: {
            is_active: true,
          },
        },
        tasks_tasks_assignee_idTousers: {
          some: {
            status: {
              not: 'DONE',
            },
            deleted_at: null,
          },
        },
      },
      include: {
        user_devices: {
          where: {
            is_active: true,
          },
          select: {
            fcm_token: true,
            platform: true,
          },
          take: 1,
        },
        tasks_tasks_assignee_idTousers: {
          where: {
            status: {
              not: 'DONE',
            },
            deleted_at: null,
          },
          select: {
            id: true,
            title: true,
            due_at: true,
            status: true,
          },
        },
      },
    });

    console.log(`✅ Found ${usersWithTasks.length} users with active tasks`);

    if (usersWithTasks.length > 0) {
      console.log('\nSample users:');
      usersWithTasks.slice(0, 3).forEach((user, index) => {
        const totalTasks = user.tasks_tasks_assignee_idTousers.length;
        const now = new Date();
        const upcomingTasks = user.tasks_tasks_assignee_idTousers.filter(
          (task) => task.due_at && task.due_at > now,
        ).length;
        const overdueTasks = user.tasks_tasks_assignee_idTousers.filter(
          (task) => task.due_at && task.due_at < now,
        ).length;

        console.log(`\n${index + 1}. User: ${user.name} (${user.email})`);
        console.log(`   Total active tasks: ${totalTasks}`);
        console.log(`   Upcoming tasks: ${upcomingTasks}`);
        console.log(`   Overdue tasks: ${overdueTasks}`);
        console.log(
          `   Has FCM Token: ${user.user_devices?.[0]?.fcm_token ? '✅' : '❌'}`,
        );
      });
    } else {
      console.log('ℹ️  No users with active tasks found.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function testFCMTokenAvailability() {
  console.log('\n========================================');
  console.log('TEST 4: Check FCM Token Availability');
  console.log('========================================\n');

  try {
    const totalUsers = await prisma.users.count();
    const usersWithDevices = await prisma.users.count({
      where: {
        user_devices: {
          some: {
            is_active: true,
          },
        },
      },
    });

    const activeDevices = await prisma.user_devices.count({
      where: {
        is_active: true,
      },
    });

    console.log(`Total users: ${totalUsers}`);
    console.log(`Users with active devices: ${usersWithDevices}`);
    console.log(`Total active devices: ${activeDevices}`);
    console.log(
      `Coverage: ${totalUsers > 0 ? ((usersWithDevices / totalUsers) * 100).toFixed(1) : 0}%`,
    );

    if (usersWithDevices === 0) {
      console.log('\n⚠️  WARNING: No users have FCM tokens registered!');
      console.log(
        '   FCM notifications will not work until users register their devices.',
      );
    } else {
      console.log('\n✅ FCM tokens are available for notifications.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Worker Service Mock Test Suite      ║');
  console.log('║   Testing Database Queries Only       ║');
  console.log('╚════════════════════════════════════════╝');

  await testUpcomingTasksQuery();
  await testOverdueTasksQuery();
  await testUsersWithActiveTasksQuery();
  await testFCMTokenAvailability();

  console.log('\n========================================');
  console.log('All Tests Completed!');
  console.log('========================================\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
