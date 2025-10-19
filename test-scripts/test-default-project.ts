/**
 * Test Script: Default Project Creation Logic
 *
 * Mục đích: Verify logic tạo workspace và default project cho user mới
 *
 * Run: npx ts-node test-scripts/test-default-project.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDefaultProjectCreation() {
  console.log('🧪 Testing Default Project Creation Logic\n');

  try {
    // Test 1: Kiểm tra workspaces không có projects
    console.log('Test 1: Finding workspaces without projects...');
    const emptyWorkspaces = await prisma.workspaces.findMany({
      where: {
        type: 'PERSONAL',
        projects: {
          none: {},
        },
      },
      include: {
        _count: {
          select: {
            projects: true,
          },
        },
      },
    });

    console.log(`  ✅ Found ${emptyWorkspaces.length} empty workspaces`);
    emptyWorkspaces.forEach((ws) => {
      console.log(`     - ${ws.name} (${ws.id})`);
    });

    // Test 2: Kiểm tra projects không có boards
    console.log('\nTest 2: Finding projects without boards...');
    const projectsWithoutBoards = await prisma.projects.findMany({
      where: {
        boards: {
          none: {},
        },
      },
      include: {
        _count: {
          select: {
            boards: true,
          },
        },
        workspaces: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log(
      `  ✅ Found ${projectsWithoutBoards.length} projects without boards`,
    );
    projectsWithoutBoards.forEach((proj) => {
      console.log(
        `     - ${proj.name} (${proj.key}) in ${proj.workspaces.name}`,
      );
    });

    // Test 3: Kiểm tra key "MFP" duplicates
    console.log('\nTest 3: Checking for duplicate MFP keys...');
    const mfpProjects = await prisma.projects.groupBy({
      by: ['workspace_id'],
      where: {
        key: {
          startsWith: 'MFP',
        },
      },
      _count: {
        key: true,
      },
      having: {
        key: {
          _count: {
            gt: 1,
          },
        },
      },
    });

    if (mfpProjects.length > 0) {
      console.log(
        `  ⚠️  Found ${mfpProjects.length} workspaces with duplicate MFP keys`,
      );
      for (const item of mfpProjects) {
        const projects = await prisma.projects.findMany({
          where: {
            workspace_id: item.workspace_id,
            key: {
              startsWith: 'MFP',
            },
          },
          select: {
            id: true,
            key: true,
            name: true,
          },
        });
        console.log(`     Workspace ${item.workspace_id}:`);
        projects.forEach((p) => console.log(`       - ${p.key}: ${p.name}`));
      }
    } else {
      console.log('  ✅ No duplicate MFP keys found');
    }

    // Test 4: Verify default project structure
    console.log('\nTest 4: Verifying default project structure...');
    const defaultProjects = await prisma.projects.findMany({
      where: {
        name: 'My First Project',
      },
      include: {
        boards: {
          orderBy: {
            order: 'asc',
          },
        },
        workspaces: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });

    console.log(`  ✅ Found ${defaultProjects.length} default projects`);
    let correctStructure = 0;
    let incorrectStructure = 0;

    defaultProjects.forEach((proj) => {
      const hasCorrectBoards =
        proj.boards.length === 3 &&
        proj.boards[0].name === 'To Do' &&
        proj.boards[1].name === 'In Progress' &&
        proj.boards[2].name === 'Done';

      if (hasCorrectBoards) {
        correctStructure++;
      } else {
        incorrectStructure++;
        console.log(
          `     ⚠️  ${proj.key} in ${proj.workspaces.name}: ${proj.boards.length} boards`,
        );
        proj.boards.forEach((b) =>
          console.log(`         - ${b.name} (order: ${b.order})`),
        );
      }
    });

    console.log(`     ✅ ${correctStructure} projects with correct structure`);
    if (incorrectStructure > 0) {
      console.log(
        `     ⚠️  ${incorrectStructure} projects with incorrect structure`,
      );
    }

    // Test 5: Check memberships
    console.log('\nTest 5: Verifying memberships...');
    const personalWorkspaces = await prisma.workspaces.findMany({
      where: {
        type: 'PERSONAL',
      },
      include: {
        memberships: {
          where: {
            role: 'OWNER',
          },
        },
      },
    });

    const workspacesWithoutOwner = personalWorkspaces.filter(
      (ws) => ws.memberships.length === 0,
    );

    if (workspacesWithoutOwner.length > 0) {
      console.log(
        `  ⚠️  Found ${workspacesWithoutOwner.length} workspaces without OWNER`,
      );
      workspacesWithoutOwner.forEach((ws) => {
        console.log(`     - ${ws.name} (${ws.id})`);
      });
    } else {
      console.log('  ✅ All personal workspaces have an OWNER');
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`  - Empty workspaces: ${emptyWorkspaces.length}`);
    console.log(`  - Projects without boards: ${projectsWithoutBoards.length}`);
    console.log(`  - Duplicate MFP keys: ${mfpProjects.length}`);
    console.log(`  - Default projects: ${defaultProjects.length}`);
    console.log(`  - Correct structure: ${correctStructure}`);
    console.log(`  - Incorrect structure: ${incorrectStructure}`);
    console.log(
      `  - Workspaces without owner: ${workspacesWithoutOwner.length}`,
    );

    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDefaultProjectCreation();
