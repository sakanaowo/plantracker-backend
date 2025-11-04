// Check projects and their workspace_id
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProjects() {
  try {
    console.log('Checking projects...\n');

    const projects = await prisma.projects.findMany({
      include: {
        workspaces: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 10,
    });

    console.log(`Found ${projects.length} projects:\n`);

    projects.forEach((project, index) => {
      console.log(`${index + 1}. Project: ${project.name} (${project.id})`);
      console.log(`   Workspace: ${project.workspace_id}`);
      console.log(`   Workspace Name: ${project.workspaces?.name || 'N/A'}`);
      console.log('');
    });

    // Check if any project has null workspace_id
    const projectsWithoutWorkspace = projects.filter(p => !p.workspace_id);
    if (projectsWithoutWorkspace.length > 0) {
      console.log(`⚠️ WARNING: ${projectsWithoutWorkspace.length} projects without workspace_id!`);
    }

    // Check recent tasks
    console.log('\n--- Recent Tasks ---');
    const recentTasks = await prisma.tasks.findMany({
      where: { deleted_at: null },
      include: {
        projects: {
          include: {
            workspaces: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    console.log(`Found ${recentTasks.length} recent tasks:\n`);

    recentTasks.forEach((task, index) => {
      console.log(`${index + 1}. Task: ${task.title} (${task.id})`);
      console.log(`   Project: ${task.projects.name}`);
      console.log(`   Workspace ID: ${task.projects.workspace_id || 'NULL - THIS IS THE PROBLEM!'}`);
      console.log(`   Created: ${task.created_at}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProjects();
