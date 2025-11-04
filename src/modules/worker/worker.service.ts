import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendUpcomingTaskReminders(): Promise<{
    success: boolean;
    sent: number;
    failed: number;
  }> {
    this.logger.log('Starting upcoming task reminders job...');

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    try {
      // Lấy danh sách tasks sắp đến hạn
      const upcomingTasks = await this.prisma.tasks.findMany({
        where: {
          due_at: {
            gte: now,
            lte: tomorrow,
          },
          status: {
            not: 'DONE',
          },
          deleted_at: null, // Chỉ lấy tasks chưa bị xóa
        },
        include: {
          task_assignees: {
            include: {
              users: {
                select: {
                  id: true,
                  name: true,
                  user_devices: {
                    where: {
                      is_active: true,
                    },
                    select: {
                      fcm_token: true,
                      platform: true,
                    },
                    take: 1, // Lấy device active đầu tiên
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

      this.logger.log(`Found ${upcomingTasks.length} upcoming tasks`);

      let sent = 0;
      let failed = 0;

      // Gửi notification cho từng task và từng assignee
      for (const task of upcomingTasks) {
        // Send notification to all assignees of this task
        for (const assignment of task.task_assignees) {
          const assignee = assignment.users;
          const activeDevice = assignee?.user_devices?.[0];

          if (!assignee || !activeDevice?.fcm_token) {
            this.logger.warn(
              `Task ${task.id}: User ${assignee?.id || 'unknown'} has no active FCM token, skipping...`,
            );
            failed++;
            continue;
          }

          try {
            const timeUntilDue = task.due_at
              ? this.getTimeUntilDue(task.due_at)
              : 'soon';

            await this.notificationsService.sendTaskReminder({
              userId: assignee.id,
              fcmToken: activeDevice.fcm_token,
              task: {
                id: task.id,
                title: task.title,
                dueDate: task.due_at,
                projectName: task.projects.name,
              },
              message: `Task "${task.title}" đến hạn trong ${timeUntilDue}`,
            });

            sent++;
            this.logger.log(
              `Sent reminder for task ${task.id} to user ${assignee.id}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to send notification for task ${task.id}:`,
              error,
            );
            failed++;
          }
        } // End of assignees loop
      } // End of tasks loop

      this.logger.log(
        `Job completed: ${sent} sent, ${failed} failed out of ${upcomingTasks.length} tasks`,
      );

      return {
        success: true,
        sent,
        failed,
      };
    } catch (error) {
      this.logger.error('Error in sendUpcomingTaskReminders:', error);
      throw error;
    }
  }

  /**
   * Gửi notification cho tasks quá hạn
   */
  async sendOverdueTaskReminders(): Promise<{
    success: boolean;
    sent: number;
    failed: number;
  }> {
    this.logger.log('Starting overdue task reminders job...');

    const now = new Date();

    try {
      // Lấy danh sách tasks quá hạn
      const overdueTasks = await this.prisma.tasks.findMany({
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
          task_assignees: {
            include: {
              users: {
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

      this.logger.log(`Found ${overdueTasks.length} overdue tasks`);

      let sent = 0;
      let failed = 0;

      for (const task of overdueTasks) {
        // Send notification to all assignees of this task
        for (const assignment of task.task_assignees) {
          const assignee = assignment.users;
          const activeDevice = assignee?.user_devices?.[0];

          if (!assignee || !activeDevice?.fcm_token) {
            failed++;
            continue;
          }

          try {
            const daysOverdue = task.due_at
              ? this.getDaysOverdue(task.due_at)
              : 0;

            await this.notificationsService.sendTaskReminder({
              userId: assignee.id,
              fcmToken: activeDevice.fcm_token,
              task: {
                id: task.id,
                title: task.title,
                dueDate: task.due_at,
                projectName: task.projects.name,
              },
              message: `⚠️ Task "${task.title}" đã quá hạn ${daysOverdue} ngày`,
            });

            sent++;
          } catch (error) {
            this.logger.error(
              `Failed to send overdue notification for task ${task.id}:`,
              error,
            );
            failed++;
          }
        } // End of assignees loop
      } // End of tasks loop

      this.logger.log(
        `Job completed: ${sent} sent, ${failed} failed out of ${overdueTasks.length} tasks`,
      );

      return {
        success: true,
        sent,
        failed,
      };
    } catch (error) {
      this.logger.error('Error in sendOverdueTaskReminders:', error);
      throw error;
    }
  }

  /**
   * Gửi daily summary notification
   */
  async sendDailySummary(): Promise<{
    success: boolean;
    sent: number;
    failed: number;
  }> {
    this.logger.log('Starting daily summary job...');

    try {
      // Lấy danh sách users có tasks active
      const usersWithTasks = await this.prisma.users.findMany({
        where: {
          user_devices: {
            some: {
              is_active: true,
            },
          },
          task_assignees: {
            some: {
              tasks: {
                status: {
                  not: 'DONE',
                },
                deleted_at: null,
              },
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
            },
            take: 1,
          },
          task_assignees: {
            include: {
              tasks: {
                select: {
                  id: true,
                  title: true,
                  due_at: true,
                  status: true,
                  deleted_at: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Found ${usersWithTasks.length} users with active tasks`);

      let sent = 0;
      let failed = 0;

      for (const user of usersWithTasks) {
        const activeDevice = user.user_devices?.[0];

        if (!activeDevice?.fcm_token) {
          failed++;
          continue;
        }

        try {
          // Get all active tasks for this user
          const activeTasks = user.task_assignees
            .map((assignment) => assignment.tasks)
            .filter((task) => task.status !== 'DONE' && !task.deleted_at);

          const totalTasks = activeTasks.length;
          const now = new Date();
          const upcomingTasks = activeTasks.filter(
            (task) => task.due_at && task.due_at > now,
          ).length;
          const overdueTasks = activeTasks.filter(
            (task) => task.due_at && task.due_at < now,
          ).length;

          await this.notificationsService.sendDailySummary({
            userId: user.id,
            fcmToken: activeDevice.fcm_token,
            summary: {
              totalTasks,
              upcomingTasks,
              overdueTasks,
            },
          });

          sent++;
        } catch (error) {
          this.logger.error(
            `Failed to send daily summary to user ${user.id}:`,
            error,
          );
          failed++;
        }
      }

      this.logger.log(
        `Job completed: ${sent} sent, ${failed} failed out of ${usersWithTasks.length} users`,
      );

      return {
        success: true,
        sent,
        failed,
      };
    } catch (error) {
      this.logger.error('Error in sendDailySummary:', error);
      throw error;
    }
  }

  /**
   * Helper: Tính thời gian còn lại đến deadline
   */
  private getTimeUntilDue(dueDate: Date): string {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} phút`;
    } else if (hours < 24) {
      return `${hours} giờ`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} ngày`;
    }
  }

  /**
   * Helper: Tính số ngày quá hạn
   */
  private getDaysOverdue(dueDate: Date): number {
    const now = new Date();
    const diff = now.getTime() - dueDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}
