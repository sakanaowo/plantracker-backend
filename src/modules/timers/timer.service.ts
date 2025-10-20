import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { time_entries } from '@prisma/client';
import { CreateTimerDto } from './dto/create-timer.dto';
import { UpdateTimerDto } from './dto/update-timer.dto';

@Injectable()
export class TimerService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTimerDto): Promise<time_entries> {
    // Validate task tồn tại
    const task = await this.prisma.tasks.findUnique({
      where: { id: dto.taskId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // chỉ 1 timer đang chạy tại 1 thời điểm cho 1 user
    const activatingTimer = await this.prisma.time_entries.findFirst({
      where: { user_id: userId, end_at: null },
    });
    if (activatingTimer) {
      // throw new ConflictException({
      //   statusCode: 409,
      //   message:
      //     'You have a running timer. Please stop it before starting a new one.',
      //   error: 'ACTIVE_TIMER_EXISTS',
      //   data: {
      //     timerId: activatingTimer.id,
      //     taskId: activatingTimer.task_id,
      //     // taskTitle: activatingTimer.tasks.title,
      //   },
      // });
      const now = new Date();
      await this.prisma.time_entries.update({
        where: {
          id: activatingTimer.id,
        },
        data: {
          end_at: now,
          duration_sec: Math.floor(
            (now.getTime() - new Date(activatingTimer.start_at).getTime()) /
              1000,
          ),
        },
      });
    }
    const timer = await this.prisma.time_entries.create({
      data: {
        task_id: dto.taskId,
        user_id: userId,
        start_at: dto.startAt ? new Date(dto.startAt) : new Date(),
        end_at: null,
        note: dto.note,
      },
    });
    return timer;
  }

  async stop(
    timerId: string,
    userId: string,
    dto: UpdateTimerDto,
  ): Promise<time_entries> {
    const existingTimer = await this.prisma.time_entries.findUnique({
      where: { id: timerId },
    });
    if (!existingTimer) {
      throw new NotFoundException('Timer not found');
    }

    if (existingTimer.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to stop this timer',
      );
    }
    if (existingTimer.end_at !== null) {
      throw new ConflictException('Timer has already been stopped');
    }

    const startAt = new Date(existingTimer.start_at);
    const endAt = dto.endAt ? new Date(dto.endAt) : new Date();

    if (endAt <= startAt) {
      throw new ConflictException('End time must be after start time');
    }

    const timer = await this.prisma.time_entries.update({
      where: { id: timerId },
      data: {
        end_at: endAt,
        duration_sec: Math.floor((endAt.getTime() - startAt.getTime()) / 1000),
        note: dto?.note ?? existingTimer.note,
      },
    });
    return timer;
  }

  async updateNote(
    timerId: string,
    userId: string,
    note: string,
  ): Promise<time_entries> {
    const timer = await this.prisma.time_entries.findUnique({
      where: { id: timerId },
    });
    if (!timer) {
      throw new NotFoundException('Timer not found');
    }
    if (timer.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this timer',
      );
    }
    return this.prisma.time_entries.update({
      where: { id: timerId },
      data: { note },
    });
  }
}
