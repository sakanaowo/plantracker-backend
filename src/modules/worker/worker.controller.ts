import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { WorkerService } from './worker.service';

@Controller('worker')
@Public() // ← Bypass Firebase/JWT auth for all worker endpoints
export class WorkerController {
  private readonly logger = new Logger(WorkerController.name);

  constructor(private readonly workerService: WorkerService) {}

  private validateWorkerToken(authHeader: string): boolean {
    const workerSecret = process.env.WORKER_SECRET_TOKEN;
    if (!workerSecret) {
      this.logger.error(
        'Worker secret token is not set in environment variables.',
      );
      return false;
    }
    const token = authHeader?.replace('Bearer ', '');
    return token === workerSecret;
  }

  @Post('upcoming-reminders')
  @HttpCode(HttpStatus.OK)
  async sendUpcomingReminders(
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('Received upcoming reminders request');

    if (!this.validateWorkerToken(authHeader)) {
      this.logger.warn('Unauthorized worker request');
      throw new UnauthorizedException('Invalid worker token');
    }

    const result = await this.workerService.sendUpcomingTaskReminders();

    return {
      job: 'upcoming-reminders',
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  @Post('overdue-reminders')
  @HttpCode(HttpStatus.OK)
  async sendOverdueReminders(
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('Received overdue reminders request');

    if (!this.validateWorkerToken(authHeader)) {
      throw new UnauthorizedException('Invalid worker token');
    }

    const result = await this.workerService.sendOverdueTaskReminders();

    return {
      job: 'overdue-reminders',
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  @Post('daily-summary')
  @HttpCode(HttpStatus.OK)
  async sendDailySummary(
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    this.logger.log('Received daily summary request');

    if (!this.validateWorkerToken(authHeader)) {
      throw new UnauthorizedException('Invalid worker token');
    }

    const result = await this.workerService.sendDailySummary();

    return {
      job: 'daily-summary',
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(
    @Headers('authorization') authHeader: string,
  ): Promise<any> {
    if (!this.validateWorkerToken(authHeader)) {
      throw new UnauthorizedException('Invalid worker token');
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'worker',
    };
  }
}
