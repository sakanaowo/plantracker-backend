# 🚀 HƯỚNG DẪN PHÁT TRIỂN - BACKEND DEVELOPER

## 👤 **NHIỆM VỤ: API & GOOGLE CALENDAR INTEGRATION**

### 🎯 **TỔNG QUAN**

Bạn chịu trách nhiệm phát triển các **API endpoints** và **Google Calendar Service** để hỗ trợ 2 Frontend Developers. Công việc của bạn là cung cấp API contracts rõ ràng và implement logic backend để 2 FE devs có thể làm việc độc lập.

---

## 📋 **DANH SÁCH CÔNG VIỆC**

### **GIAI ĐOẠN 1: DATABASE SCHEMA UPDATES (TUẦN 1 - 1 NGÀY)**

#### **Task 1.1: Update Prisma Schema**

**File: /prisma/schema.prisma**

```prisma
model Task {
  id                    String              @id @default(uuid())
  title                 String
  description           String?
  dueDate               DateTime?
  priority              Int?
  
  // NEW: Calendar integration
  calendarEventId       String?             @map("calendar_event_id")
  calendarReminderEnabled Boolean           @default(false) @map("calendar_reminder_enabled")
  calendarReminderTime  Int?                @map("calendar_reminder_time") // minutes before
  lastSyncedAt          DateTime?           @map("last_synced_at")
  
  // Relations
  boardId               String              @map("board_id")
  board                 Board               @relation(fields: [boardId], references: [id], onDelete: Cascade)
  
  projectId             String?             @map("project_id")
  project               Project?            @relation(fields: [projectId], references: [id])
  
  createdBy             String              @map("created_by")
  creator               User                @relation("TaskCreator", fields: [createdBy], references: [id])
  
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  
  @@map("tasks")
}

// NEW: Events table
model Event {
  id                String          @id @default(uuid())
  projectId         String          @map("project_id")
  project           Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  title             String
  description       String?
  eventDate         DateTime        @map("event_date")
  eventTime         String          @map("event_time") // HH:mm format
  duration          Int             // minutes
  
  type              EventType       @default(OTHER)
  recurrence        RecurrenceType  @default(NONE)
  
  // Google Calendar integration
  calendarEventId   String?         @map("calendar_event_id")
  meetLink          String?         @map("meet_link")
  
  // Attendees
  attendees         EventAttendee[]
  
  createdBy         String          @map("created_by")
  creator           User            @relation(fields: [createdBy], references: [id])
  
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")
  
  @@map("events")
}

enum EventType {
  MEETING
  MILESTONE
  OTHER
}

enum RecurrenceType {
  NONE
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
}

model EventAttendee {
  id          String    @id @default(uuid())
  eventId     String    @map("event_id")
  event       Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)
  
  userId      String    @map("user_id")
  user        User      @relation(fields: [userId], references: [id])
  
  status      AttendeeStatus @default(PENDING)
  
  @@unique([eventId, userId])
  @@map("event_attendees")
}

enum AttendeeStatus {
  PENDING
  ACCEPTED
  DECLINED
}

// Update User model
model User {
  id                  String            @id @default(uuid())
  email               String            @unique
  displayName         String?           @map("display_name")
  
  // NEW: Google Calendar integration
  googleAccessToken   String?           @map("google_access_token")
  googleRefreshToken  String?           @map("google_refresh_token")
  googleTokenExpiry   DateTime?         @map("google_token_expiry")
  calendarSyncEnabled Boolean           @default(false) @map("calendar_sync_enabled")
  
  // Relations
  createdTasks        Task[]            @relation("TaskCreator")
  createdEvents       Event[]
  eventAttendances    EventAttendee[]
  
  createdAt           DateTime          @default(now()) @map("created_at")
  updatedAt           DateTime          @updatedAt @map("updated_at")
  
  @@map("users")
}
```

**Run migration:**

```bash
npx prisma migrate dev --name add_calendar_integration
npx prisma generate
```

**Checklist Task 1.1:**
- [ ] Update schema.prisma
- [ ] Run migration
- [ ] Test schema updates
- [ ] Update seed data nếu cần

---

### **GIAI ĐOẠN 2: GOOGLE CALENDAR SERVICE (TUẦN 1 - 3 NGÀY)**

#### **Task 2.1: Create GoogleCalendarService**

**File: src/modules/google-calendar/google-calendar.service.ts**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private calendar: calendar_v3.Calendar;

  constructor(private prisma: PrismaService) {
    this.calendar = google.calendar('v3');
  }

  /**
   * Get OAuth2 client for user
   */
  private async getOAuth2Client(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiry: true,
      },
    });

    if (!user || !user.googleRefreshToken) {
      throw new Error('User has not connected Google Calendar');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
      expiry_date: user.googleTokenExpiry?.getTime(),
    });

    // Auto refresh token if expired
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            googleAccessToken: tokens.access_token,
            googleRefreshToken: tokens.refresh_token,
            googleTokenExpiry: new Date(tokens.expiry_date),
          },
        });
      }
    });

    return oauth2Client;
  }

  /**
   * Create task reminder event in Google Calendar
   */
  async createTaskReminderEvent(
    userId: string,
    taskId: string,
    title: string,
    dueDate: Date,
    reminderMinutes: number,
  ): Promise<string> {
    try {
      const auth = await this.getOAuth2Client(userId);

      const event: calendar_v3.Schema$Event = {
        summary: `⏰ Nhắc nhở: ${title}`,
        description: `Đây là nhắc nhở cho task: ${title}\n\nTask ID: ${taskId}`,
        start: {
          dateTime: new Date(dueDate.getTime() - reminderMinutes * 60000).toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        end: {
          dateTime: new Date(dueDate.getTime() - reminderMinutes * 60000 + 15 * 60000).toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 10 },
            { method: 'email', minutes: 30 },
          ],
        },
        colorId: '11', // Red color
      };

      const response = await this.calendar.events.insert({
        auth,
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: 0,
      });

      this.logger.log(`Created task reminder event: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      this.logger.error(`Failed to create task reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update task reminder event
   */
  async updateTaskReminderEvent(
    userId: string,
    calendarEventId: string,
    title: string,
    dueDate: Date,
    reminderMinutes: number,
  ): Promise<void> {
    try {
      const auth = await this.getOAuth2Client(userId);

      const event: calendar_v3.Schema$Event = {
        summary: `⏰ Nhắc nhở: ${title}`,
        start: {
          dateTime: new Date(dueDate.getTime() - reminderMinutes * 60000).toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        end: {
          dateTime: new Date(dueDate.getTime() - reminderMinutes * 60000 + 15 * 60000).toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
      };

      await this.calendar.events.patch({
        auth,
        calendarId: 'primary',
        eventId: calendarEventId,
        requestBody: event,
      });

      this.logger.log(`Updated task reminder event: ${calendarEventId}`);
    } catch (error) {
      this.logger.error(`Failed to update task reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete task reminder event
   */
  async deleteTaskReminderEvent(userId: string, calendarEventId: string): Promise<void> {
    try {
      const auth = await this.getOAuth2Client(userId);

      await this.calendar.events.delete({
        auth,
        calendarId: 'primary',
        eventId: calendarEventId,
      });

      this.logger.log(`Deleted task reminder event: ${calendarEventId}`);
    } catch (error) {
      this.logger.error(`Failed to delete task reminder: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create project event (meeting) in Google Calendar
   */
  async createProjectEvent(
    userId: string,
    eventData: {
      title: string;
      description?: string;
      eventDate: Date;
      duration: number;
      attendeeEmails: string[];
      createMeet: boolean;
    },
  ): Promise<{ calendarEventId: string; meetLink?: string }> {
    try {
      const auth = await this.getOAuth2Client(userId);

      const endDate = new Date(eventData.eventDate.getTime() + eventData.duration * 60000);

      const event: calendar_v3.Schema$Event = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.eventDate.toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh',
        },
        attendees: eventData.attendeeEmails.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 10 },
            { method: 'email', minutes: 60 },
          ],
        },
        conferenceData: eventData.createMeet
          ? {
              createRequest: {
                requestId: `meet-${Date.now()}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            }
          : undefined,
      };

      const response = await this.calendar.events.insert({
        auth,
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: eventData.createMeet ? 1 : 0,
        sendUpdates: 'all', // Send email to attendees
      });

      const meetLink = response.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video',
      )?.uri;

      this.logger.log(`Created project event: ${response.data.id}`);

      return {
        calendarEventId: response.data.id,
        meetLink,
      };
    } catch (error) {
      this.logger.error(`Failed to create project event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update project event
   */
  async updateProjectEvent(
    userId: string,
    calendarEventId: string,
    eventData: {
      title?: string;
      description?: string;
      eventDate?: Date;
      duration?: number;
      attendeeEmails?: string[];
    },
  ): Promise<void> {
    try {
      const auth = await this.getOAuth2Client(userId);

      // Get existing event first
      const existing = await this.calendar.events.get({
        auth,
        calendarId: 'primary',
        eventId: calendarEventId,
      });

      const updates: calendar_v3.Schema$Event = {
        summary: eventData.title || existing.data.summary,
        description: eventData.description || existing.data.description,
      };

      if (eventData.eventDate) {
        const endDate = new Date(
          eventData.eventDate.getTime() + (eventData.duration || 60) * 60000,
        );
        updates.start = {
          dateTime: eventData.eventDate.toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh',
        };
        updates.end = {
          dateTime: endDate.toISOString(),
          timeZone: 'Asia/Ho_Chi_Minh',
        };
      }

      if (eventData.attendeeEmails) {
        updates.attendees = eventData.attendeeEmails.map(email => ({ email }));
      }

      await this.calendar.events.patch({
        auth,
        calendarId: 'primary',
        eventId: calendarEventId,
        requestBody: updates,
        sendUpdates: 'all',
      });

      this.logger.log(`Updated project event: ${calendarEventId}`);
    } catch (error) {
      this.logger.error(`Failed to update project event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete project event
   */
  async deleteProjectEvent(userId: string, calendarEventId: string): Promise<void> {
    try {
      const auth = await this.getOAuth2Client(userId);

      await this.calendar.events.delete({
        auth,
        calendarId: 'primary',
        eventId: calendarEventId,
        sendUpdates: 'all', // Notify attendees
      });

      this.logger.log(`Deleted project event: ${calendarEventId}`);
    } catch (error) {
      this.logger.error(`Failed to delete project event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get calendar events for project (for Calendar Tab)
   */
  async getCalendarEvents(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<calendar_v3.Schema$Event[]> {
    try {
      const auth = await this.getOAuth2Client(userId);

      const response = await this.calendar.events.list({
        auth,
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      });

      return response.data.items || [];
    } catch (error) {
      this.logger.error(`Failed to get calendar events: ${error.message}`);
      throw error;
    }
  }
}
```

**Checklist Task 2.1:**
- [ ] Create google-calendar.service.ts
- [ ] Implement OAuth2 client
- [ ] Implement createTaskReminderEvent
- [ ] Implement createProjectEvent with Google Meet
- [ ] Implement update/delete methods
- [ ] Test with real Google Calendar API
- [ ] Add error handling và retry logic

---

### **GIAI ĐOẠN 3: TASKS API MODIFICATIONS (TUẦN 1 - 2 NGÀY)**

#### **Task 3.1: Update TasksService**

**File: src/modules/tasks/tasks.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private googleCalendar: GoogleCalendarService,
  ) {}

  /**
   * Update task with calendar sync
   */
  async updateTaskWithCalendarSync(
    userId: string,
    taskId: string,
    updateData: {
      title?: string;
      dueDate?: Date;
      calendarReminderEnabled?: boolean;
      calendarReminderTime?: number;
    },
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Check if user has calendar sync enabled
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { calendarSyncEnabled: true, googleRefreshToken: true },
    });

    const shouldSyncCalendar = user?.calendarSyncEnabled && user?.googleRefreshToken;

    // Handle calendar sync
    if (shouldSyncCalendar && updateData.calendarReminderEnabled) {
      if (task.calendarEventId) {
        // Update existing event
        await this.googleCalendar.updateTaskReminderEvent(
          userId,
          task.calendarEventId,
          updateData.title || task.title,
          updateData.dueDate || task.dueDate,
          updateData.calendarReminderTime || 30,
        );
      } else {
        // Create new event
        const calendarEventId = await this.googleCalendar.createTaskReminderEvent(
          userId,
          taskId,
          updateData.title || task.title,
          updateData.dueDate || task.dueDate,
          updateData.calendarReminderTime || 30,
        );

        updateData['calendarEventId'] = calendarEventId;
      }

      updateData['lastSyncedAt'] = new Date();
    } else if (task.calendarEventId && !updateData.calendarReminderEnabled) {
      // Remove from calendar
      try {
        await this.googleCalendar.deleteTaskReminderEvent(userId, task.calendarEventId);
      } catch (error) {
        // Ignore if already deleted
      }

      updateData['calendarEventId'] = null;
    }

    // Update task in database
    return this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });
  }

  /**
   * Get tasks with calendar info for Calendar Tab
   */
  async getTasksForCalendar(
    userId: string,
    projectId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        creator: {
          select: { displayName: true, email: true },
        },
        board: {
          select: { name: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      hasReminder: task.calendarReminderEnabled,
      reminderTime: task.calendarReminderTime,
      creator: task.creator,
      boardName: task.board.name,
    }));
  }
}
```

#### **Task 3.2: Update TasksController**

**File: src/modules/tasks/tasks.controller.ts**

```typescript
import { Controller, Put, Body, Param, Get, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Put(':id/calendar-sync')
  async updateCalendarSync(
    @CurrentUser() user,
    @Param('id') taskId: string,
    @Body() body: {
      calendarReminderEnabled: boolean;
      calendarReminderTime?: number;
    },
  ) {
    return this.tasksService.updateTaskWithCalendarSync(user.id, taskId, body);
  }

  @Get('calendar')
  async getTasksForCalendar(
    @CurrentUser() user,
    @Query('projectId') projectId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.tasksService.getTasksForCalendar(
      user.id,
      projectId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
```

**Checklist Task 3:**
- [ ] Update TasksService với calendar sync logic
- [ ] Update TasksController với endpoints mới
- [ ] Add DTOs for validation
- [ ] Test task creation with calendar sync
- [ ] Test task update with calendar sync

---

### **GIAI ĐOẠN 4: EVENTS API (TUẦN 2 - 2 NGÀY)**

#### **Task 4.1: Create EventsModule**

**File: src/modules/events/events.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module';

@Module({
  imports: [PrismaModule, GoogleCalendarModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
```

#### **Task 4.2: Create EventsService**

**File: src/modules/events/events.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { CreateEventDto, UpdateEventDto } from './dto';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private googleCalendar: GoogleCalendarService,
  ) {}

  /**
   * Get events for project
   */
  async getProjectEvents(projectId: string, filter: 'UPCOMING' | 'PAST' | 'RECURRING') {
    const now = new Date();

    const where: any = { projectId };

    if (filter === 'UPCOMING') {
      where.eventDate = { gte: now };
    } else if (filter === 'PAST') {
      where.eventDate = { lt: now };
    } else if (filter === 'RECURRING') {
      where.recurrence = { not: 'NONE' };
    }

    return this.prisma.event.findMany({
      where,
      include: {
        creator: {
          select: { displayName: true, email: true },
        },
        attendees: {
          include: {
            user: {
              select: { displayName: true, email: true },
            },
          },
        },
      },
      orderBy: { eventDate: filter === 'PAST' ? 'desc' : 'asc' },
    });
  }

  /**
   * Create event
   */
  async createEvent(userId: string, dto: CreateEventDto) {
    // Get attendee emails
    const attendees = await this.prisma.user.findMany({
      where: { id: { in: dto.attendeeIds } },
      select: { email: true },
    });

    const attendeeEmails = attendees.map(a => a.email);

    // Create in Google Calendar if user has it connected
    let calendarEventId: string | null = null;
    let meetLink: string | null = null;

    try {
      const result = await this.googleCalendar.createProjectEvent(userId, {
        title: dto.title,
        description: dto.description,
        eventDate: new Date(`${dto.date} ${dto.time}`),
        duration: dto.duration,
        attendeeEmails,
        createMeet: dto.createGoogleMeet,
      });

      calendarEventId = result.calendarEventId;
      meetLink = result.meetLink;
    } catch (error) {
      // Continue without calendar integration
      console.error('Failed to create calendar event:', error);
    }

    // Create in database
    const event = await this.prisma.event.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        eventDate: new Date(`${dto.date} ${dto.time}`),
        eventTime: dto.time,
        duration: dto.duration,
        type: dto.type,
        recurrence: dto.recurrence,
        calendarEventId,
        meetLink,
        createdBy: userId,
        attendees: {
          create: dto.attendeeIds.map(attendeeId => ({
            userId: attendeeId,
          })),
        },
      },
      include: {
        attendees: {
          include: {
            user: true,
          },
        },
      },
    });

    return event;
  }

  /**
   * Update event
   */
  async updateEvent(userId: string, eventId: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Update in Google Calendar
    if (event.calendarEventId) {
      try {
        const attendees = await this.prisma.user.findMany({
          where: { id: { in: dto.attendeeIds } },
          select: { email: true },
        });

        await this.googleCalendar.updateProjectEvent(userId, event.calendarEventId, {
          title: dto.title,
          description: dto.description,
          eventDate: dto.date ? new Date(`${dto.date} ${dto.time}`) : undefined,
          duration: dto.duration,
          attendeeEmails: attendees.map(a => a.email),
        });
      } catch (error) {
        console.error('Failed to update calendar event:', error);
      }
    }

    // Update in database
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...dto,
        eventDate: dto.date ? new Date(`${dto.date} ${dto.time}`) : undefined,
      },
    });
  }

  /**
   * Delete event
   */
  async deleteEvent(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Delete from Google Calendar
    if (event.calendarEventId) {
      try {
        await this.googleCalendar.deleteProjectEvent(userId, event.calendarEventId);
      } catch (error) {
        console.error('Failed to delete calendar event:', error);
      }
    }

    // Delete from database
    return this.prisma.event.delete({
      where: { id: eventId },
    });
  }

  /**
   * Send reminder to attendees
   */
  async sendReminder(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendees: {
          include: { user: true },
        },
      },
    });

    // TODO: Send notification/email to attendees
    // This can be integrated with your notification system

    return { success: true };
  }
}
```

#### **Task 4.3: Create EventsController**

**File: src/modules/events/events.controller.ts**

```typescript
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateEventDto, UpdateEventDto } from './dto';

@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get('projects/:projectId')
  async getProjectEvents(
    @Param('projectId') projectId: string,
    @Query('filter') filter: 'UPCOMING' | 'PAST' | 'RECURRING' = 'UPCOMING',
  ) {
    return this.eventsService.getProjectEvents(projectId, filter);
  }

  @Get(':id')
  async getEventById(@Param('id') eventId: string) {
    // TODO: Implement
  }

  @Post()
  async createEvent(@CurrentUser() user, @Body() dto: CreateEventDto) {
    return this.eventsService.createEvent(user.id, dto);
  }

  @Put(':id')
  async updateEvent(
    @CurrentUser() user,
    @Param('id') eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(user.id, eventId, dto);
  }

  @Delete(':id')
  async deleteEvent(@CurrentUser() user, @Param('id') eventId: string) {
    return this.eventsService.deleteEvent(user.id, eventId);
  }

  @Post(':id/send-reminder')
  async sendReminder(@Param('id') eventId: string) {
    return this.eventsService.sendReminder(eventId);
  }
}
```

#### **Task 4.4: Create DTOs**

**File: src/modules/events/dto/create-event.dto.ts**

```typescript
import { IsString, IsNotEmpty, IsInt, IsBoolean, IsArray, IsEnum, IsOptional } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  time: string; // HH:mm

  @IsInt()
  duration: number; // minutes

  @IsEnum(['MEETING', 'MILESTONE', 'OTHER'])
  type: 'MEETING' | 'MILESTONE' | 'OTHER';

  @IsEnum(['NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'])
  recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

  @IsArray()
  attendeeIds: string[];

  @IsBoolean()
  createGoogleMeet: boolean;
}
```

**Checklist Task 4:**
- [ ] Create EventsModule
- [ ] Create EventsService
- [ ] Create EventsController
- [ ] Create DTOs
- [ ] Test CRUD operations
- [ ] Test Google Meet creation
- [ ] Add proper error handling

---

### **GIAI ĐOẠN 5: GOOGLE AUTH ENDPOINTS (TUẦN 2 - 1 NGÀY)**

#### **Task 5.1: Update GoogleAuthController**

**File: src/modules/google-auth/google-auth.controller.ts**

```typescript
import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('google-auth')
export class GoogleAuthController {
  constructor(private googleAuthService: GoogleAuthService) {}

  /**
   * Get authorization URL
   */
  @Get('authorize-url')
  getAuthorizeUrl(@CurrentUser() user) {
    return this.googleAuthService.getAuthorizationUrl(user.id);
  }

  /**
   * OAuth callback
   */
  @Get('callback')
  async handleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res) {
    try {
      const result = await this.googleAuthService.handleOAuthCallback(code, state);
      
      // Redirect to success page
      res.redirect(`/google-calendar-connected?success=true`);
    } catch (error) {
      res.redirect(`/google-calendar-connected?success=false&error=${error.message}`);
    }
  }

  /**
   * Check connection status
   */
  @Get('status')
  async getConnectionStatus(@CurrentUser() user) {
    return this.googleAuthService.getConnectionStatus(user.id);
  }

  /**
   * Disconnect Google Calendar
   */
  @Post('disconnect')
  async disconnect(@CurrentUser() user) {
    return this.googleAuthService.disconnect(user.id);
  }
}
```

**Checklist Task 5:**
- [ ] Update GoogleAuthController
- [ ] Test OAuth flow
- [ ] Test connection status endpoint
- [ ] Test disconnect endpoint

---

## 📦 **ENVIRONMENT VARIABLES**

**File: .env**

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-auth/callback

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/plantracker

# Other configs
```

---

## 🔗 **API CONTRACTS**

### **For Frontend Dev 1 (Calendar Tab):**

```text
GET  /api/tasks/calendar
  Query: projectId, startDate, endDate
  Response: Task[] with calendar info

PUT  /api/tasks/:id/calendar-sync
  Body: { calendarReminderEnabled, calendarReminderTime }
  Response: Updated task

GET  /api/google-auth/status
  Response: { connected, calendarSyncEnabled }

GET  /api/google-auth/authorize-url
  Response: { url }
```

### **For Frontend Dev 2 (Events Tab):**

```text
GET  /api/events/projects/:projectId
  Query: filter (UPCOMING | PAST | RECURRING)
  Response: Event[]

POST /api/events
  Body: CreateEventDto
  Response: Created event with meetLink

PUT  /api/events/:id
  Body: UpdateEventDto
  Response: Updated event

DELETE /api/events/:id
  Response: { success: true }

POST /api/events/:id/send-reminder
  Response: { success: true }
```

---

## ✅ **DEFINITION OF DONE**

1. ✅ Database schema updated và migrated
2. ✅ GoogleCalendarService hoàn chỉnh
3. ✅ Tasks API có calendar sync
4. ✅ Events CRUD APIs hoàn chỉnh
5. ✅ Google Meet integration hoạt động
6. ✅ OAuth flow hoàn chỉnh
7. ✅ Error handling và retry logic
8. ✅ API documentation
9. ✅ Code review và approve
10. ✅ Không có critical bugs

---

## 🧪 **TESTING**

### **Test OAuth Flow:**

```bash
# Start server
npm run start:dev

# Open browser
http://localhost:3000/api/google-auth/authorize-url

# Complete OAuth flow
# Check database for tokens
```

### **Test API Endpoints:**

```bash
# Use Postman or curl
curl -X GET http://localhost:3000/api/tasks/calendar?projectId=xxx&startDate=2024-01-01&endDate=2024-12-31

curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"projectId":"xxx","title":"Daily Standup","date":"2024-11-15","time":"09:00","duration":15,"type":"MEETING","recurrence":"DAILY","attendeeIds":[],"createGoogleMeet":true}'
```

---

## 📞 **SUPPORT**

- **Hỏi Frontend Dev 1:** Về format response cần thiết
- **Hỏi Frontend Dev 2:** Về event fields cần thiết
- **Daily standup:** Báo cáo API readiness

**Chúc bạn code vui vẻ! 🚀**
