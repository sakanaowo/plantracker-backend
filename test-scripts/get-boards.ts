// Get boards from database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getBoards() {
  try {
    const project = await prisma.projects.findFirst({
      where: {
        id: 'de59804b-df6e-4c17-992c-0616b1ec2f08',
      },
      include: {
        boards: true,
      },
    });

    if (project) {
      console.log('Project:', project.name);
      console.log('Workspace ID:', project.workspace_id);
      console.log('\nBoards:');
      project.boards.forEach(board => {
        console.log(`  - ${board.name} (${board.id})`);
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

getBoards();
