import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TimerService } from './timer.service';
import { CreateTimerDto } from './dto/create-timer.dto';
import { time_entries } from '@prisma/client';
import { UpdateTimerDto } from './dto/update-timer.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { CurrentUser } from 'src/auth/current-user.decorator';

@Controller('timers')
export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  @Post('start')
  async startTimer(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTimerDto,
  ): Promise<time_entries> {
    return this.timerService.create(userId, dto);
  }

  @Patch(':timerId/stop')
  async stopTimer(
    @Param('timerId', new ParseUUIDPipe()) timerId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTimerDto,
  ): Promise<time_entries> {
    return this.timerService.stop(timerId, userId, dto);
  }

  @Patch(':timerId/note')
  async updateNote(
    @Param('timerId', new ParseUUIDPipe()) timerId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<time_entries> {
    return this.timerService.updateNote(timerId, userId, dto.note);
  }
}
