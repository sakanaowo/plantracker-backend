import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { boards } from '@prisma/client';
import { CombinedAuthGuard } from '../../auth/combined-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('boards')
@UseGuards(CombinedAuthGuard)
export class BoardsController {
  constructor(private readonly svc: BoardsService) {}
  @Get()
  list(@Query('projectId') projectId: string): Promise<boards[]> {
    return this.svc.listByProject(projectId);
  }
  @Post()
  create(
    @Body() dto: CreateBoardDto,
    @CurrentUser('id') userId: string,
  ): Promise<boards> {
    return this.svc.create(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBoardDto,
    @CurrentUser('id') userId: string,
  ): Promise<boards> {
    return this.svc.update(id, dto, userId);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<boards> {
    return this.svc.remove(id, userId);
  }
}
