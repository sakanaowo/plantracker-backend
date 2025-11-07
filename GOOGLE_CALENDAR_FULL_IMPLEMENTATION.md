# 📋 KỊCH BẢN TRIỂN KHAI ĐẦY ĐỦ - TÍCH HỢP GOOGLE CALENDAR

## 🎨 **PHÂN TÍCH GIAO DIỆN HIỆN TẠI**

### **ProjectActivity - Cấu trúc hiện tại:**

```xml
Layout: project_main.xml
├── Header
│   ├── btnClosePjrDetail (ImageButton - Đóng)
│   ├── tvProjectName (TextView - Tên dự án)
│   └── ivProjectMenu (ImageView - Menu 3 chấm)
├── TabLayout (3 tabs)
│   ├── tabBoard ✅ (Đã có giao diện - boardsRecyclerView)
│   ├── tabCalendar ⚠️ (Chưa có giao diện)
│   └── tabEvent ⚠️ (Chưa có giao diện)
└── boardsRecyclerView (RecyclerView - Hiển thị boards Trello style)
```

### **CardDetailActivity - Cấu trúc hiện tại:**

```java
Các trường dữ liệu:
├── etTaskTitle (EditText - Tiêu đề nhiệm vụ)
├── tvBoardName (TextView - Tên board)
├── etDescription (EditText - Mô tả)
├── etDateStart (EditText - Ngày bắt đầu)
├── etDueDate (EditText - Hạn chót) ⭐ 
├── Priority Buttons (LOW/MEDIUM/HIGH)
├── btnMembers (MaterialButton - Gán thành viên)
├── Checklist RecyclerView
├── Labels (HorizontalScrollView)
├── rvComments (RecyclerView - Bình luận)
└── rvAttachments (RecyclerView - Tệp đính kèm)
```

---

## 🎯 **TRƯỜNG HỢP SỬ DỤNG 1: NHẮC NHỞ HẠN CHÓT NHIỆM VỤ**

### **📱 ĐỀ XUẤT GIAO DIỆN MỚI**

#### **1.1. Thêm vào CardDetailActivity**

```xml
<!-- Thêm vào layout card_detail.xml sau etDueDate -->
<LinearLayout
    android:id="@+id/calendarSyncSection"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="16dp"
    android:background="@drawable/rounded_background_light_green"
    android:layout_marginTop="8dp">
    
    <!-- Header với icon và status -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">
        
        <ImageView
            android:id="@+id/ivCalendarIcon"
            android:layout_width="24dp"
            android:layout_height="24dp"
            android:src="@drawable/ic_google_calendar"
            android:tint="#4285F4"/>
        
        <TextView
            android:id="@+id/tvCalendarSyncStatus"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:layout_marginStart="12dp"
            android:text="Đồng bộ với Google Calendar"
            android:textSize="14sp"
            android:textStyle="bold"
            android:textColor="#2E7D32"/>
        
        <com.google.android.material.switchmaterial.SwitchMaterial
            android:id="@+id/switchCalendarSync"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:checked="true"/>
    </LinearLayout>
    
    <!-- Chi tiết đồng bộ -->
    <LinearLayout
        android:id="@+id/layoutCalendarDetails"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:layout_marginTop="12dp"
        android:visibility="visible">
        
        <TextView
            android:id="@+id/tvCalendarEventInfo"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="📅 Sự kiện: Sửa lỗi đăng nhập - Hạn chót\n⏰ Nhắc nhở: 15 phút, 1 giờ, 1 ngày trước\n🔗 Đã đồng bộ 5 phút trước"
            android:textSize="12sp"
            android:textColor="#666666"
            android:lineSpacingExtra="4dp"/>
        
        <com.google.android.material.button.MaterialButton
            android:id="@+id/btnViewInCalendar"
            android:layout_width="wrap_content"
            android:layout_height="36dp"
            android:layout_marginTop="8dp"
            android:text="Xem trong Calendar"
            android:textSize="12sp"
            android:backgroundTint="#E8F5E9"
            android:textColor="#2E7D32"
            style="@style/Widget.MaterialComponents.Button.TextButton"
            app:icon="@drawable/ic_open_in_new"
            app:iconTint="#2E7D32"
            app:iconSize="16dp"/>
    </LinearLayout>
</LinearLayout>

<!-- Settings Dialog cho Calendar Sync -->
<com.google.android.material.button.MaterialButton
    android:id="@+id/btnCalendarSyncSettings"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
    android:text="⚙️ Cài đặt nhắc nhở"
    android:textSize="14sp"
    style="@style/Widget.MaterialComponents.Button.OutlinedButton"/>
```

#### **1.2. Dialog cài đặt nhắc nhở (CalendarReminderSettingsDialog.java)**

```xml
<!-- layout: dialog_calendar_reminder_settings.xml -->
<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="24dp">
    
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Cài đặt nhắc nhở Calendar"
        android:textSize="20sp"
        android:textStyle="bold"
        android:textColor="#212121"/>
    
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="Chọn thời điểm nhận nhắc nhở về hạn chót"
        android:textSize="14sp"
        android:textColor="#757575"/>
    
    <!-- Checkbox cho các mốc thời gian -->
    <CheckBox
        android:id="@+id/cbReminder15Min"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:text="15 phút trước"
        android:checked="true"/>
    
    <CheckBox
        android:id="@+id/cbReminder1Hour"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="1 giờ trước"
        android:checked="true"/>
    
    <CheckBox
        android:id="@+id/cbReminder1Day"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="1 ngày trước"
        android:checked="true"/>
    
    <CheckBox
        android:id="@+id/cbReminder1Week"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="1 tuần trước"/>
    
    <!-- Nút hành động -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="24dp"
        android:orientation="horizontal"
        android:gravity="end">
        
        <Button
            android:id="@+id/btnCancel"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Hủy"
            style="@style/Widget.MaterialComponents.Button.TextButton"/>
        
        <Button
            android:id="@+id/btnSave"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginStart="8dp"
            android:text="Lưu"
            android:backgroundTint="#4CAF50"/>
    </LinearLayout>
</LinearLayout>
```

### **🔧 KỊCH BẢN 1.1: TẠO NHIỆM VỤ VỚI HẠN CHÓT**

#### **Frontend Flow (Android):**

```java
// CardDetailActivity.java
public class CardDetailActivity extends AppCompatActivity {
    private SwitchMaterial switchCalendarSync;
    private MaterialButton btnCalendarSyncSettings;
    private TextView tvCalendarEventInfo;
    private LinearLayout layoutCalendarDetails;
    
    private boolean isCalendarSyncEnabled = true;
    private List<Integer> reminderMinutes = Arrays.asList(15, 60, 1440); // 15min, 1h, 1day
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // ... existing code ...
        
        setupCalendarSyncUI();
    }
    
    private void setupCalendarSyncUI() {
        switchCalendarSync = findViewById(R.id.switchCalendarSync);
        btnCalendarSyncSettings = findViewById(R.id.btnCalendarSyncSettings);
        tvCalendarEventInfo = findViewById(R.id.tvCalendarEventInfo);
        layoutCalendarDetails = findViewById(R.id.layoutCalendarDetails);
        
        // Kiểm tra xem user đã kết nối Google Calendar chưa
        checkGoogleCalendarConnection();
        
        // Toggle calendar sync
        switchCalendarSync.setOnCheckedChangeListener((buttonView, isChecked) -> {
            isCalendarSyncEnabled = isChecked;
            layoutCalendarDetails.setVisibility(isChecked ? View.VISIBLE : View.GONE);
            
            if (isChecked && !isGoogleCalendarConnected()) {
                // Hiển thị dialog yêu cầu kết nối
                showConnectGoogleCalendarDialog();
            }
        });
        
        // Mở settings dialog
        btnCalendarSyncSettings.setOnClickListener(v -> {
            showReminderSettingsDialog();
        });
        
        // View in Calendar button
        findViewById(R.id.btnViewInCalendar).setOnClickListener(v -> {
            if (currentTask != null && currentTask.getCalendarEventId() != null) {
                openGoogleCalendarEvent(currentTask.getCalendarEventId());
            }
        });
    }
    
    private void checkGoogleCalendarConnection() {
        // Gọi API kiểm tra connection status
        ApiClient.getInstance().getGoogleAuthService()
            .checkIntegrationStatus()
            .enqueue(new Callback<GoogleCalendarStatusResponse>() {
                @Override
                public void onResponse(Call<GoogleCalendarStatusResponse> call, 
                                     Response<GoogleCalendarStatusResponse> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        boolean connected = response.body().isConnected();
                        updateCalendarSyncUI(connected);
                    }
                }
                
                @Override
                public void onFailure(Call<GoogleCalendarStatusResponse> call, Throwable t) {
                    Log.e(TAG, "Failed to check calendar connection", t);
                }
            });
    }
    
    private void updateCalendarSyncUI(boolean connected) {
        if (!connected) {
            switchCalendarSync.setEnabled(false);
            tvCalendarEventInfo.setText("⚠️ Chưa kết nối Google Calendar. Nhấn để kết nối.");
            tvCalendarEventInfo.setOnClickListener(v -> showConnectGoogleCalendarDialog());
        }
    }
    
    private void showConnectGoogleCalendarDialog() {
        new AlertDialog.Builder(this)
            .setTitle("Kết nối Google Calendar")
            .setMessage("Để sử dụng tính năng đồng bộ lịch, bạn cần kết nối với Google Calendar.")
            .setPositiveButton("Kết nối ngay", (dialog, which) -> {
                // Mở OAuth flow
                startGoogleCalendarAuth();
            })
            .setNegativeButton("Để sau", null)
            .show();
    }
    
    private void startGoogleCalendarAuth() {
        // Lấy auth URL từ backend
        ApiClient.getInstance().getGoogleAuthService()
            .getAuthUrl()
            .enqueue(new Callback<AuthUrlResponse>() {
                @Override
                public void onResponse(Call<AuthUrlResponse> call, 
                                     Response<AuthUrlResponse> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        String authUrl = response.body().getUrl();
                        // Mở WebView hoặc Chrome Custom Tab
                        openAuthUrl(authUrl);
                    }
                }
                
                @Override
                public void onFailure(Call<AuthUrlResponse> call, Throwable t) {
                    Toast.makeText(CardDetailActivity.this, 
                        "Không thể kết nối. Vui lòng thử lại.", 
                        Toast.LENGTH_SHORT).show();
                }
            });
    }
    
    private void showReminderSettingsDialog() {
        CalendarReminderSettingsDialog dialog = new CalendarReminderSettingsDialog();
        dialog.setCurrentReminders(reminderMinutes);
        dialog.setOnSaveListener(newReminders -> {
            reminderMinutes = newReminders;
            updateReminderInfoText();
        });
        dialog.show(getSupportFragmentManager(), "reminder_settings");
    }
    
    private void updateReminderInfoText() {
        StringBuilder info = new StringBuilder("📅 Sự kiện: " + etTaskTitle.getText() + " - Hạn chót\n");
        info.append("⏰ Nhắc nhở: ");
        
        List<String> reminderTexts = new ArrayList<>();
        for (int minutes : reminderMinutes) {
            if (minutes < 60) {
                reminderTexts.add(minutes + " phút");
            } else if (minutes < 1440) {
                reminderTexts.add((minutes / 60) + " giờ");
            } else {
                reminderTexts.add((minutes / 1440) + " ngày");
            }
        }
        info.append(String.join(", ", reminderTexts)).append(" trước");
        
        if (currentTask != null && currentTask.getCalendarSyncedAt() != null) {
            long minutesAgo = (System.currentTimeMillis() - currentTask.getCalendarSyncedAt()) / 60000;
            info.append("\n🔗 Đã đồng bộ ").append(minutesAgo).append(" phút trước");
        }
        
        tvCalendarEventInfo.setText(info.toString());
    }
    
    private void saveTask() {
        // ... existing validation code ...
        
        Task task = new Task();
        task.setTitle(etTaskTitle.getText().toString());
        task.setDescription(etDescription.getText().toString());
        task.setDueDate(parseDateFromEditText(etDueDate));
        task.setPriority(currentPriority);
        // ... other fields ...
        
        // Thêm thông tin calendar sync
        task.setCalendarSyncEnabled(isCalendarSyncEnabled);
        task.setCalendarReminderMinutes(reminderMinutes);
        
        if (isEditMode) {
            updateTask(task);
        } else {
            createTask(task);
        }
    }
    
    private void createTask(Task task) {
        taskViewModel.createTask(task).observe(this, result -> {
            if (result.isSuccess()) {
                Task createdTask = result.getData();
                
                // Hiển thị thông báo thành công
                Toast.makeText(this, "✅ Nhiệm vụ đã được tạo", Toast.LENGTH_SHORT).show();
                
                // Nếu có calendar sync và đã kết nối
                if (isCalendarSyncEnabled && createdTask.getCalendarEventId() != null) {
                    showCalendarSyncSuccessSnackbar(createdTask);
                }
                
                // Return result
                Intent resultIntent = new Intent();
                resultIntent.putExtra("task", createdTask);
                setResult(RESULT_OK, resultIntent);
                finish();
            } else {
                Toast.makeText(this, 
                    "❌ Lỗi: " + result.getErrorMessage(), 
                    Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    private void showCalendarSyncSuccessSnackbar(Task task) {
        Snackbar.make(findViewById(android.R.id.content),
            "📅 Đã đồng bộ với Google Calendar",
            Snackbar.LENGTH_LONG)
            .setAction("Xem", v -> openGoogleCalendarEvent(task.getCalendarEventId()))
            .setActionTextColor(Color.parseColor("#4CAF50"))
            .show();
    }
    
    private void openGoogleCalendarEvent(String eventId) {
        try {
            // Mở Google Calendar app với event cụ thể
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("content://com.android.calendar/events/" + eventId));
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            // Fallback: mở web browser
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("https://calendar.google.com/calendar/event?eid=" + eventId));
            startActivity(intent);
        }
    }
}
```

#### **Backend Flow (NestJS):**

```typescript
// src/modules/tasks/tasks.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private googleCalendarService: GoogleCalendarService,
  ) {}

  async create(userId: string, createTaskDto: CreateTaskDto) {
    // 1️⃣ Tạo task trong database
    const task = await this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        due_date: createTaskDto.dueDate,
        priority: createTaskDto.priority,
        board_id: createTaskDto.boardId,
        created_by: userId,
        calendar_sync_enabled: createTaskDto.calendarSyncEnabled ?? false,
        calendar_reminder_minutes: createTaskDto.calendarReminderMinutes,
      },
      include: {
        board: {
          include: {
            project: true,
          },
        },
      },
    });

    // 2️⃣ Nếu có due_date và calendar sync enabled
    if (task.due_date && task.calendar_sync_enabled) {
      try {
        // Tạo calendar event
        const calendarEvent = await this.googleCalendarService.createDeadlineEvent({
          userId,
          taskId: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.due_date,
          reminderMinutes: task.calendar_reminder_minutes || [15, 60, 1440],
          projectName: task.board.project.name,
          deepLink: `plantracker://tasks/${task.id}`,
        });

        // 3️⃣ Update task với calendar_event_id
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            calendar_event_id: calendarEvent.id,
            calendar_synced_at: new Date(),
          },
        });

        // 4️⃣ Log activity
        await this.prisma.activity_log.create({
          data: {
            entity_type: 'TASK',
            entity_id: task.id,
            action_type: 'CALENDAR_SYNCED',
            action_details: {
              calendarEventId: calendarEvent.id,
              eventLink: calendarEvent.htmlLink,
            },
            user_id: userId,
            workspace_id: task.board.project.workspace_id,
          },
        });

        // 5️⃣ Gửi notification
        await this.notificationService.sendCalendarSyncNotification({
          userId,
          taskTitle: task.title,
          calendarEventLink: calendarEvent.htmlLink,
        });

      } catch (error) {
        // Log lỗi nhưng không fail toàn bộ request
        console.error('Failed to sync with Google Calendar:', error);
        
        // Lưu vào pending sync queue
        await this.prisma.pending_calendar_sync.create({
          data: {
            task_id: task.id,
            user_id: userId,
            sync_type: 'CREATE',
            retry_count: 0,
          },
        });
      }
    }

    return task;
  }
}
```

#### **GoogleCalendarService Implementation:**

```typescript
// src/modules/google-calendar/google-calendar.service.ts
import { Injectable } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface CreateDeadlineEventDto {
  userId: string;
  taskId: string;
  title: string;
  description?: string;
  dueDate: Date;
  reminderMinutes: number[];
  projectName: string;
  deepLink: string;
}

@Injectable()
export class GoogleCalendarService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async createDeadlineEvent(dto: CreateDeadlineEventDto): Promise<calendar_v3.Schema$Event> {
    // 1️⃣ Lấy OAuth tokens của user
    const userTokens = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        google_access_token: true,
        google_refresh_token: true,
      },
    });

    if (!userTokens?.google_access_token) {
      throw new Error('User chưa kết nối Google Calendar');
    }

    // 2️⃣ Setup OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );

    oauth2Client.setCredentials({
      access_token: userTokens.google_access_token,
      refresh_token: userTokens.google_refresh_token,
    });

    // 3️⃣ Tạo Calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // 4️⃣ Tính toán thời gian event (1 giờ trước due date)
    const dueDate = new Date(dto.dueDate);
    const eventStart = new Date(dueDate.getTime() - 60 * 60 * 1000); // 1 hour before
    const eventEnd = dueDate;

    // 5️⃣ Tạo reminders
    const reminders = {
      useDefault: false,
      overrides: dto.reminderMinutes.map(minutes => ({
        method: 'popup' as const,
        minutes: minutes,
      })),
    };

    // 6️⃣ Tạo event description với deep link
    const eventDescription = `
Hạn chót nhiệm vụ từ PlanTracker

📋 Dự án: ${dto.projectName}
📝 Mô tả: ${dto.description || 'Không có mô tả'}

🔗 Nhấn để xem chi tiết: ${dto.deepLink}
    `.trim();

    // 7️⃣ Tạo event
    const event: calendar_v3.Schema$Event = {
      summary: `📝 ${dto.title} - Hạn chót`,
      description: eventDescription,
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      end: {
        dateTime: eventEnd.toISOString(),
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      reminders: reminders,
      colorId: '11', // Màu đỏ cho deadline
      source: {
        title: 'PlanTracker',
        url: dto.deepLink,
      },
    };

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      return response.data;
    } catch (error) {
      // Nếu token hết hạn, refresh và thử lại
      if (error.code === 401) {
        await this.refreshAccessToken(dto.userId);
        // Retry
        return this.createDeadlineEvent(dto);
      }
      throw error;
    }
  }

  async updateDeadlineEvent(
    userId: string,
    eventId: string,
    updates: Partial<CreateDeadlineEventDto>,
  ): Promise<calendar_v3.Schema$Event> {
    // Similar implementation với events.update
    // ...
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    // Implementation với events.delete
    // ...
  }

  private async refreshAccessToken(userId: string): Promise<void> {
    // Implementation refresh token logic
    // ...
  }
}
```

### **📊 KỊCH BẢN 1.2: CẬP NHẬT HẠN CHÓT**

```java
// CardDetailActivity.java - Update flow
private void updateTask(Task task) {
    // Kiểm tra xem due_date có thay đổi không
    boolean dueDateChanged = !Objects.equals(
        currentTask.getDueDate(), 
        task.getDueDate()
    );
    
    taskViewModel.updateTask(task).observe(this, result -> {
        if (result.isSuccess()) {
            Task updatedTask = result.getData();
            
            // Hiển thị thông báo khác nhau tùy vào calendar sync
            if (dueDateChanged && updatedTask.getCalendarSyncEnabled()) {
                Toast.makeText(this, 
                    "✅ Đã cập nhật nhiệm vụ và lịch", 
                    Toast.LENGTH_SHORT).show();
                
                // Hiển thị snackbar với option xem trong calendar
                showCalendarUpdateSnackbar(updatedTask);
            } else {
                Toast.makeText(this, 
                    "✅ Đã cập nhật nhiệm vụ", 
                    Toast.LENGTH_SHORT).show();
            }
            
            setResult(RESULT_OK);
            finish();
        } else {
            // Xử lý lỗi
            handleUpdateError(result);
        }
    });
}

private void showCalendarUpdateSnackbar(Task task) {
    Snackbar.make(findViewById(android.R.id.content),
        "📅 Hạn chót đã được cập nhật trong Calendar",
        Snackbar.LENGTH_LONG)
        .setAction("Xem", v -> openGoogleCalendarEvent(task.getCalendarEventId()))
        .setActionTextColor(Color.parseColor("#4CAF50"))
        .show();
}
```

---

## 🎯 **TRƯỜNG HỢP SỬ DỤNG 2: TAB CALENDAR TRONG PROJECT**

### **📱 ĐỀ XUẤT GIAO DIỆN TAB CALENDAR**

#### **2.1. Tạo CalendarFragment**

```xml
<!-- layout: fragment_project_calendar.xml -->
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#F6F6F6">
    
    <!-- Toolbar với filter và export -->
    <com.google.android.material.card.MaterialCardView
        android:id="@+id/cardToolbar"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        app:layout_constraintTop_toTopOf="parent"
        app:cardElevation="2dp"
        app:cardCornerRadius="0dp"
        android:layout_margin="0dp">
        
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:padding="12dp"
            android:gravity="center_vertical">
            
            <!-- View mode selector -->
            <com.google.android.material.button.MaterialButtonToggleGroup
                android:id="@+id/toggleViewMode"
                android:layout_width="wrap_content"
                android:layout_height="36dp"
                app:singleSelection="true"
                app:selectionRequired="true">
                
                <Button
                    android:id="@+id/btnWeekView"
                    android:layout_width="wrap_content"
                    android:layout_height="match_parent"
                    android:text="Tuần"
                    style="@style/Widget.MaterialComponents.Button.OutlinedButton"/>
                
                <Button
                    android:id="@+id/btnMonthView"
                    android:layout_width="wrap_content"
                    android:layout_height="match_parent"
                    android:text="Tháng"
                    android:checked="true"
                    style="@style/Widget.MaterialComponents.Button.OutlinedButton"/>
            </com.google.android.material.button.MaterialButtonToggleGroup>
            
            <View
                android:layout_width="0dp"
                android:layout_height="1dp"
                android:layout_weight="1"/>
            
            <!-- Filter button -->
            <ImageButton
                android:id="@+id/btnFilter"
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:src="@drawable/ic_filter"
                android:background="?attr/selectableItemBackgroundBorderless"
                android:contentDescription="Lọc"/>
            
            <!-- Sync with Google Calendar -->
            <ImageButton
                android:id="@+id/btnSyncCalendar"
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:layout_marginStart="8dp"
                android:src="@drawable/ic_sync"
                android:background="?attr/selectableItemBackgroundBorderless"
                android:contentDescription="Đồng bộ"/>
            
            <!-- Export -->
            <ImageButton
                android:id="@+id/btnExport"
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:layout_marginStart="8dp"
                android:src="@drawable/ic_download"
                android:background="?attr/selectableItemBackgroundBorderless"
                android:contentDescription="Xuất"/>
        </LinearLayout>
    </com.google.android.material.card.MaterialCardView>
    
    <!-- Calendar View -->
    <com.prolificinteractive.materialcalendarview.MaterialCalendarView
        android:id="@+id/calendarView"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        app:layout_constraintTop_toBottomOf="@id/cardToolbar"
        app:mcv_showOtherDates="all"
        app:mcv_selectionColor="#4CAF50"
        app:mcv_headerTextAppearance="@style/CalendarHeaderTextStyle"
        app:mcv_weekDayTextAppearance="@style/CalendarWeekDayTextStyle"
        app:mcv_dateTextAppearance="@style/CalendarDateTextStyle"/>
    
    <!-- Legend -->
    <HorizontalScrollView
        android:id="@+id/scrollLegend"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        app:layout_constraintTop_toBottomOf="@id/calendarView"
        android:padding="12dp"
        android:scrollbars="none">
        
        <LinearLayout
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:orientation="horizontal">
            
            <!-- Deadline tasks -->
            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:padding="8dp"
                android:background="@drawable/rounded_background_light">
                
                <View
                    android:layout_width="12dp"
                    android:layout_height="12dp"
                    android:background="@drawable/circle_red"/>
                
                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="6dp"
                    android:text="📝 Hạn chót"
                    android:textSize="12sp"/>
            </LinearLayout>
            
            <!-- Meetings -->
            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginStart="8dp"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:padding="8dp"
                android:background="@drawable/rounded_background_light">
                
                <View
                    android:layout_width="12dp"
                    android:layout_height="12dp"
                    android:background="@drawable/circle_blue"/>
                
                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="6dp"
                    android:text="📋 Họp"
                    android:textSize="12sp"/>
            </LinearLayout>
            
            <!-- Milestones -->
            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginStart="8dp"
                android:orientation="horizontal"
                android:gravity="center_vertical"
                android:padding="8dp"
                android:background="@drawable/rounded_background_light">
                
                <View
                    android:layout_width="12dp"
                    android:layout_height="12dp"
                    android:background="@drawable/circle_purple"/>
                
                <TextView
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="6dp"
                    android:text="🎯 Milestone"
                    android:textSize="12sp"/>
            </LinearLayout>
        </LinearLayout>
    </HorizontalScrollView>
    
    <!-- Events list for selected date -->
    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/rvCalendarEvents"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        app:layout_constraintTop_toBottomOf="@id/scrollLegend"
        app:layout_constraintBottom_toBottomOf="parent"
        android:padding="12dp"
        android:clipToPadding="false"/>
    
    <!-- Empty state -->
    <LinearLayout
        android:id="@+id/layoutEmptyState"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:gravity="center"
        android:visibility="gone"
        app:layout_constraintTop_toTopOf="@id/rvCalendarEvents"
        app:layout_constraintBottom_toBottomOf="@id/rvCalendarEvents"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent">
        
        <ImageView
            android:layout_width="120dp"
            android:layout_height="120dp"
            android:src="@drawable/ic_calendar_empty"
            android:alpha="0.3"/>
        
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="Không có sự kiện nào"
            android:textSize="16sp"
            android:textColor="#757575"/>
        
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="4dp"
            android:text="Tạo nhiệm vụ có hạn chót để xem ở đây"
            android:textSize="14sp"
            android:textColor="#BDBDBD"/>
    </LinearLayout>
    
    <!-- Loading -->
    <ProgressBar
        android:id="@+id/progressBar"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:visibility="gone"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"/>
    
    <!-- FAB để tạo event mới -->
    <com.google.android.material.floatingactionbutton.FloatingActionButton
        android:id="@+id/fabAddEvent"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_margin="16dp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:src="@drawable/ic_add"
        app:backgroundTint="#4CAF50"
        android:contentDescription="Thêm sự kiện"/>
</androidx.constraintlayout.widget.ConstraintLayout>
```

#### **2.2. Calendar Event Item Layout**

```xml
<!-- layout: item_calendar_event.xml -->
<com.google.android.material.card.MaterialCardView
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginVertical="4dp"
    app:cardElevation="2dp"
    app:cardCornerRadius="8dp">
    
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:padding="12dp">
        
        <!-- Color indicator -->
        <View
            android:id="@+id/viewEventColor"
            android:layout_width="4dp"
            android:layout_height="match_parent"
            android:layout_marginEnd="12dp"
            android:background="#F44336"/>
        
        <!-- Time -->
        <LinearLayout
            android:layout_width="60dp"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:gravity="center">
            
            <TextView
                android:id="@+id/tvEventTime"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="14:00"
                android:textSize="16sp"
                android:textStyle="bold"
                android:textColor="#212121"/>
            
            <TextView
                android:id="@+id/tvEventDuration"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="1h"
                android:textSize="12sp"
                android:textColor="#757575"/>
        </LinearLayout>
        
        <!-- Event details -->
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:layout_marginStart="12dp"
            android:orientation="vertical">
            
            <TextView
                android:id="@+id/tvEventTitle"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="📝 Sửa lỗi đăng nhập - Hạn chót"
                android:textSize="15sp"
                android:textStyle="bold"
                android:textColor="#212121"
                android:maxLines="2"
                android:ellipsize="end"/>
            
            <TextView
                android:id="@+id/tvEventProject"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="4dp"
                android:text="Dự án: Ứng dụng Web"
                android:textSize="13sp"
                android:textColor="#757575"/>
            
            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginTop="6dp"
                android:orientation="horizontal">
                
                <ImageView
                    android:id="@+id/ivGoogleCalendar"
                    android:layout_width="16dp"
                    android:layout_height="16dp"
                    android:src="@drawable/ic_google_calendar"
                    android:visibility="gone"/>
                
                <TextView
                    android:id="@+id/tvSyncStatus"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="4dp"
                    android:text="Đã đồng bộ"
                    android:textSize="11sp"
                    android:textColor="#4CAF50"
                    android:visibility="gone"/>
            </LinearLayout>
        </LinearLayout>
        
        <!-- Actions -->
        <ImageButton
            android:id="@+id/btnEventMenu"
            android:layout_width="40dp"
            android:layout_height="40dp"
            android:src="@drawable/ic_more_vert"
            android:background="?attr/selectableItemBackgroundBorderless"
            android:contentDescription="Menu"/>
    </LinearLayout>
</com.google.android.material.card.MaterialCardView>
```

#### **2.3. ProjectCalendarFragment.java**

```java
package com.example.tralalero.feature.home.ui.Home.project;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.prolificinteractive.materialcalendarview.MaterialCalendarView;
import com.prolificinteractive.materialcalendarview.CalendarDay;
import com.prolificinteractive.materialcalendarview.OnDateSelectedListener;

import java.util.ArrayList;
import java.util.List;
import java.util.Calendar;

public class ProjectCalendarFragment extends Fragment {
    private MaterialCalendarView calendarView;
    private RecyclerView rvCalendarEvents;
    private CalendarEventAdapter eventAdapter;
    private View layoutEmptyState;
    private ProgressBar progressBar;
    
    private ProjectCalendarViewModel viewModel;
    private String projectId;
    private CalendarDay selectedDate;
    
    public static ProjectCalendarFragment newInstance(String projectId) {
        ProjectCalendarFragment fragment = new ProjectCalendarFragment();
        Bundle args = new Bundle();
        args.putString("project_id", projectId);
        fragment.setArguments(args);
        return fragment;
    }
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            projectId = getArguments().getString("project_id");
        }
    }
    
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                           Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_project_calendar, container, false);
        
        initViews(view);
        setupViewModel();
        setupCalendar();
        setupRecyclerView();
        setupButtons(view);
        loadCalendarData();
        
        return view;
    }
    
    private void initViews(View view) {
        calendarView = view.findViewById(R.id.calendarView);
        rvCalendarEvents = view.findViewById(R.id.rvCalendarEvents);
        layoutEmptyState = view.findViewById(R.id.layoutEmptyState);
        progressBar = view.findViewById(R.id.progressBar);
    }
    
    private void setupViewModel() {
        viewModel = new ViewModelProvider(this).get(ProjectCalendarViewModel.class);
    }
    
    private void setupCalendar() {
        // Set today as selected
        selectedDate = CalendarDay.today();
        calendarView.setSelectedDate(selectedDate);
        
        // Date selection listener
        calendarView.setOnDateChangedListener((widget, date, selected) -> {
            selectedDate = date;
            loadEventsForDate(date);
        });
        
        // Customize calendar decorators
        calendarView.addDecorators(
            new EventDecorator(Color.RED, getDeadlineDates()),
            new EventDecorator(Color.BLUE, getMeetingDates()),
            new EventDecorator(Color.parseColor("#9C27B0"), getMilestoneDates())
        );
    }
    
    private void setupRecyclerView() {
        eventAdapter = new CalendarEventAdapter();
        rvCalendarEvents.setLayoutManager(new LinearLayoutManager(getContext()));
        rvCalendarEvents.setAdapter(eventAdapter);
        
        // Item click listener
        eventAdapter.setOnEventClickListener(event -> {
            // Mở TaskDetail nếu là task deadline
            if (event.getType() == CalendarEventType.TASK_DEADLINE) {
                openTaskDetail(event.getTaskId());
            } else {
                // Mở event detail
                openEventDetail(event.getId());
            }
        });
        
        // Menu click listener
        eventAdapter.setOnEventMenuClickListener((event, view) -> {
            showEventMenu(event, view);
        });
    }
    
    private void setupButtons(View view) {
        // View mode toggle
        MaterialButtonToggleGroup toggleViewMode = view.findViewById(R.id.toggleViewMode);
        toggleViewMode.addOnButtonCheckedListener((group, checkedId, isChecked) -> {
            if (isChecked) {
                if (checkedId == R.id.btnWeekView) {
                    calendarView.state().edit()
                        .setCalendarDisplayMode(CalendarMode.WEEKS)
                        .commit();
                } else {
                    calendarView.state().edit()
                        .setCalendarDisplayMode(CalendarMode.MONTHS)
                        .commit();
                }
            }
        });
        
        // Filter button
        view.findViewById(R.id.btnFilter).setOnClickListener(v -> {
            showFilterDialog();
        });
        
        // Sync button
        view.findViewById(R.id.btnSyncCalendar).setOnClickListener(v -> {
            syncWithGoogleCalendar();
        });
        
        // Export button
        view.findViewById(R.id.btnExport).setOnClickListener(v -> {
            showExportDialog();
        });
        
        // FAB add event
        view.findViewById(R.id.fabAddEvent).setOnClickListener(v -> {
            showAddEventDialog();
        });
    }
    
    private void loadCalendarData() {
        progressBar.setVisibility(View.VISIBLE);
        
        // Lấy events của tháng hiện tại
        Calendar calendar = Calendar.getInstance();
        int year = calendar.get(Calendar.YEAR);
        int month = calendar.get(Calendar.MONTH) + 1;
        
        viewModel.loadProjectCalendarEvents(projectId, year, month)
            .observe(getViewLifecycleOwner(), result -> {
                progressBar.setVisibility(View.GONE);
                
                if (result.isSuccess()) {
                    List<CalendarEvent> events = result.getData();
                    updateCalendarDecorators(events);
                    
                    // Load events cho ngày đã chọn
                    loadEventsForDate(selectedDate);
                } else {
                    Toast.makeText(getContext(), 
                        "Lỗi: " + result.getErrorMessage(), 
                        Toast.LENGTH_SHORT).show();
                }
            });
    }
    
    private void loadEventsForDate(CalendarDay date) {
        viewModel.getEventsForDate(projectId, date)
            .observe(getViewLifecycleOwner(), events -> {
                if (events != null && !events.isEmpty()) {
                    eventAdapter.setEvents(events);
                    rvCalendarEvents.setVisibility(View.VISIBLE);
                    layoutEmptyState.setVisibility(View.GONE);
                } else {
                    rvCalendarEvents.setVisibility(View.GONE);
                    layoutEmptyState.setVisibility(View.VISIBLE);
                }
            });
    }
    
    private void updateCalendarDecorators(List<CalendarEvent> events) {
        // Group events by type
        List<CalendarDay> deadlineDates = new ArrayList<>();
        List<CalendarDay> meetingDates = new ArrayList<>();
        List<CalendarDay> milestoneDates = new ArrayList<>();
        
        for (CalendarEvent event : events) {
            CalendarDay day = CalendarDay.from(event.getDate());
            switch (event.getType()) {
                case TASK_DEADLINE:
                    deadlineDates.add(day);
                    break;
                case MEETING:
                    meetingDates.add(day);
                    break;
                case MILESTONE:
                    milestoneDates.add(day);
                    break;
            }
        }
        
        // Update decorators
        calendarView.removeDecorators();
        calendarView.addDecorators(
            new EventDecorator(Color.RED, deadlineDates),
            new EventDecorator(Color.BLUE, meetingDates),
            new EventDecorator(Color.parseColor("#9C27B0"), milestoneDates)
        );
        calendarView.invalidateDecorators();
    }
    
    private void syncWithGoogleCalendar() {
        // Show loading
        progressBar.setVisibility(View.VISIBLE);
        
        viewModel.syncWithGoogleCalendar(projectId)
            .observe(getViewLifecycleOwner(), result -> {
                progressBar.setVisibility(View.GONE);
                
                if (result.isSuccess()) {
                    Toast.makeText(getContext(), 
                        "✅ Đã đồng bộ thành công", 
                        Toast.LENGTH_SHORT).show();
                    
                    // Reload data
                    loadCalendarData();
                } else {
                    Toast.makeText(getContext(), 
                        "❌ Lỗi đồng bộ: " + result.getErrorMessage(), 
                        Toast.LENGTH_SHORT).show();
                }
            });
    }
    
    private void showFilterDialog() {
        CalendarFilterDialog dialog = new CalendarFilterDialog();
        dialog.setCurrentFilters(viewModel.getCurrentFilters());
        dialog.setOnFiltersChangedListener(filters -> {
            viewModel.setFilters(filters);
            loadCalendarData();
        });
        dialog.show(getChildFragmentManager(), "filter_dialog");
    }
    
    private void showExportDialog() {
        new AlertDialog.Builder(getContext())
            .setTitle("Xuất lịch")
            .setItems(new String[]{"PDF", "Excel (CSV)", "iCalendar (.ics)"}, 
                (dialog, which) -> {
                    switch (which) {
                        case 0:
                            exportToPdf();
                            break;
                        case 1:
                            exportToCsv();
                            break;
                        case 2:
                            exportToIcs();
                            break;
                    }
                })
            .show();
    }
    
    private void openTaskDetail(String taskId) {
        Intent intent = new Intent(getContext(), CardDetailActivity.class);
        intent.putExtra(CardDetailActivity.EXTRA_TASK_ID, taskId);
        startActivity(intent);
    }
}
```

---

## 🎯 **TRƯỜNG HỢP SỬ DỤNG 3: TAB EVENT - QUẢN LÝ MEETINGS**

### **📱 ĐỀ XUẤT GIAO DIỆN TAB EVENT**

#### **3.1. EventFragment Layout**

```xml
<!-- layout: fragment_project_events.xml -->
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#F6F6F6">
    
    <!-- Toolbar -->
    <com.google.android.material.card.MaterialCardView
        android:id="@+id/cardToolbar"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        app:layout_constraintTop_toTopOf="parent"
        app:cardElevation="2dp">
        
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:padding="12dp"
            android:gravity="center_vertical">
            
            <TextView
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="Sự kiện và cuộc họp"
                android:textSize="18sp"
                android:textStyle="bold"
                android:textColor="#212121"/>
            
            <ImageButton
                android:id="@+id/btnFilterEvents"
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:src="@drawable/ic_filter"
                android:background="?attr/selectableItemBackgroundBorderless"/>
            
            <ImageButton
                android:id="@+id/btnSearchEvents"
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:layout_marginStart="8dp"
                android:src="@drawable/ic_search"
                android:background="?attr/selectableItemBackgroundBorderless"/>
        </LinearLayout>
    </com.google.android.material.card.MaterialCardView>
    
    <!-- Tabs: Upcoming, Past, Recurring -->
    <com.google.android.material.tabs.TabLayout
        android:id="@+id/tabLayoutEvents"
        android:layout_width="match_parent"
        android:layout_height="48dp"
        app:layout_constraintTop_toBottomOf="@id/cardToolbar"
        app:tabMode="fixed"
        app:tabGravity="fill"
        app:tabIndicatorColor="#4CAF50">
        
        <com.google.android.material.tabs.TabItem
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Sắp tới"/>
        
        <com.google.android.material.tabs.TabItem
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Đã qua"/>
        
        <com.google.android.material.tabs.TabItem
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Lặp lại"/>
    </com.google.android.material.tabs.TabLayout>
    
    <!-- RecyclerView for events -->
    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/rvEvents"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        app:layout_constraintTop_toBottomOf="@id/tabLayoutEvents"
        app:layout_constraintBottom_toBottomOf="parent"
        android:padding="12dp"
        android:clipToPadding="false"/>
    
    <!-- Empty state -->
    <LinearLayout
        android:id="@+id/layoutEmptyState"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:gravity="center"
        android:visibility="gone"
        app:layout_constraintTop_toTopOf="@id/rvEvents"
        app:layout_constraintBottom_toBottomOf="@id/rvEvents"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent">
        
        <ImageView
            android:layout_width="120dp"
            android:layout_height="120dp"
            android:src="@drawable/ic_event_empty"
            android:alpha="0.3"/>
        
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="Chưa có sự kiện nào"
            android:textSize="16sp"
            android:textColor="#757575"/>
        
        <Button
            android:id="@+id/btnCreateFirstEvent"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="Tạo sự kiện đầu tiên"
            android:backgroundTint="#4CAF50"/>
    </LinearLayout>
    
    <!-- FAB -->
    <com.google.android.material.floatingactionbutton.FloatingActionButton
        android:id="@+id/fabCreateEvent"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_margin="16dp"
        app:layout_constraintBottom_toBottomOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        android:src="@drawable/ic_add"
        app:backgroundTint="#4CAF50"/>
</androidx.constraintlayout.widget.ConstraintLayout>
```

#### **3.2. Event Item Layout**

```xml
<!-- layout: item_project_event.xml -->
<com.google.android.material.card.MaterialCardView
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginVertical="6dp"
    app:cardElevation="2dp"
    app:cardCornerRadius="12dp">
    
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical">
        
        <!-- Header with date and type -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:padding="16dp"
            android:gravity="center_vertical">
            
            <!-- Date box -->
            <LinearLayout
                android:layout_width="60dp"
                android:layout_height="60dp"
                android:orientation="vertical"
                android:gravity="center"
                android:background="@drawable/rounded_background_gradient_blue">
                
                <TextView
                    android:id="@+id/tvEventDay"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="15"
                    android:textSize="24sp"
                    android:textStyle="bold"
                    android:textColor="#FFFFFF"/>
                
                <TextView
                    android:id="@+id/tvEventMonth"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="THG 11"
                    android:textSize="11sp"
                    android:textColor="#FFFFFF"/>
            </LinearLayout>
            
            <!-- Event details -->
            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:layout_marginStart="16dp"
                android:orientation="vertical">
                
                <TextView
                    android:id="@+id/tvEventTitle"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text="📋 Daily Standup - Web App"
                    android:textSize="16sp"
                    android:textStyle="bold"
                    android:textColor="#212121"
                    android:maxLines="2"
                    android:ellipsize="end"/>
                
                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="6dp"
                    android:orientation="horizontal"
                    android:gravity="center_vertical">
                    
                    <ImageView
                        android:layout_width="14dp"
                        android:layout_height="14dp"
                        android:src="@drawable/ic_clock"
                        app:tint="#757575"/>
                    
                    <TextView
                        android:id="@+id/tvEventTime"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_marginStart="6dp"
                        android:text="09:00 - 09:15 (15 phút)"
                        android:textSize="13sp"
                        android:textColor="#757575"/>
                </LinearLayout>
                
                <LinearLayout
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginTop="4dp"
                    android:orientation="horizontal"
                    android:gravity="center_vertical">
                    
                    <ImageView
                        android:layout_width="14dp"
                        android:layout_height="14dp"
                        android:src="@drawable/ic_people"
                        app:tint="#757575"/>
                    
                    <TextView
                        android:id="@+id/tvEventAttendees"
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:layout_marginStart="6dp"
                        android:text="5 người tham gia"
                        android:textSize="13sp"
                        android:textColor="#757575"/>
                </LinearLayout>
            </LinearLayout>
            
            <!-- Actions -->
            <ImageButton
                android:id="@+id/btnEventMenu"
                android:layout_width="40dp"
                android:layout_height="40dp"
                android:src="@drawable/ic_more_vert"
                android:background="?attr/selectableItemBackgroundBorderless"/>
        </LinearLayout>
        
        <!-- Meeting link and actions (collapsible) -->
        <LinearLayout
            android:id="@+id/layoutEventActions"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="vertical"
            android:paddingHorizontal="16dp"
            android:paddingBottom="12dp"
            android:visibility="gone">
            
            <View
                android:layout_width="match_parent"
                android:layout_height="1dp"
                android:background="#E0E0E0"
                android:layout_marginBottom="12dp"/>
            
            <!-- Google Meet link -->
            <LinearLayout
                android:id="@+id/layoutMeetLink"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:padding="8dp"
                android:background="@drawable/rounded_background_light_blue"
                android:gravity="center_vertical">
                
                <ImageView
                    android:layout_width="24dp"
                    android:layout_height="24dp"
                    android:src="@drawable/ic_google_meet"/>
                
                <TextView
                    android:id="@+id/tvMeetLink"
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:layout_marginStart="12dp"
                    android:text="meet.google.com/abc-defg-hij"
                    android:textSize="13sp"
                    android:textColor="#1976D2"/>
                
                <ImageButton
                    android:id="@+id/btnCopyMeetLink"
                    android:layout_width="32dp"
                    android:layout_height="32dp"
                    android:src="@drawable/ic_copy"
                    android:background="?attr/selectableItemBackgroundBorderless"
                    app:tint="#1976D2"/>
            </LinearLayout>
            
            <!-- Action buttons -->
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="12dp"
                android:orientation="horizontal">
                
                <Button
                    android:id="@+id/btnJoinMeeting"
                    android:layout_width="0dp"
                    android:layout_height="40dp"
                    android:layout_weight="1"
                    android:text="Tham gia"
                    android:textSize="13sp"
                    android:backgroundTint="#4CAF50"
                    app:icon="@drawable/ic_videocam"
                    app:iconSize="18dp"/>
                
                <Button
                    android:id="@+id/btnViewDetails"
                    android:layout_width="0dp"
                    android:layout_height="40dp"
                    android:layout_weight="1"
                    android:layout_marginStart="8dp"
                    android:text="Chi tiết"
                    android:textSize="13sp"
                    style="@style/Widget.MaterialComponents.Button.OutlinedButton"/>
            </LinearLayout>
        </LinearLayout>
    </LinearLayout>
</com.google.android.material.card.MaterialCardView>
```

#### **3.3. Create Event Dialog**

```xml
<!-- layout: dialog_create_event.xml -->
<ScrollView
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content">
    
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="24dp">
        
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Tạo sự kiện mới"
            android:textSize="22sp"
            android:textStyle="bold"
            android:textColor="#212121"/>
        
        <!-- Event title -->
        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="20dp"
            android:hint="Tiêu đề sự kiện"
            app:startIconDrawable="@drawable/ic_event">
            
            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etEventTitle"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:inputType="text"
                android:maxLines="1"/>
        </com.google.android.material.textfield.TextInputLayout>
        
        <!-- Event type -->
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="Loại sự kiện"
            android:textSize="14sp"
            android:textColor="#757575"/>
        
        <RadioGroup
            android:id="@+id/rgEventType"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:orientation="horizontal">
            
            <RadioButton
                android:id="@+id/rbMeeting"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="📋 Họp"
                android:checked="true"/>
            
            <RadioButton
                android:id="@+id/rbMilestone"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="🎯 Milestone"/>
            
            <RadioButton
                android:id="@+id/rbOther"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="📌 Khác"/>
        </RadioGroup>
        
        <!-- Date and time -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:orientation="horizontal">
            
            <com.google.android.material.textfield.TextInputLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:hint="Ngày"
                app:startIconDrawable="@drawable/ic_calendar">
                
                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/etEventDate"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:focusable="false"
                    android:clickable="true"
                    android:inputType="none"/>
            </com.google.android.material.textfield.TextInputLayout>
            
            <com.google.android.material.textfield.TextInputLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:layout_marginStart="8dp"
                android:hint="Giờ"
                app:startIconDrawable="@drawable/ic_clock">
                
                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/etEventTime"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:focusable="false"
                    android:clickable="true"
                    android:inputType="none"/>
            </com.google.android.material.textfield.TextInputLayout>
        </LinearLayout>
        
        <!-- Duration -->
        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="12dp"
            android:hint="Thời lượng (phút)"
            app:startIconDrawable="@drawable/ic_timer">
            
            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etDuration"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:inputType="number"
                android:text="30"/>
        </com.google.android.material.textfield.TextInputLayout>
        
        <!-- Description -->
        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="12dp"
            android:hint="Mô tả"
            app:startIconDrawable="@drawable/ic_description">
            
            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etEventDescription"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:inputType="textMultiLine"
                android:minLines="3"
                android:maxLines="5"
                android:gravity="top"/>
        </com.google.android.material.textfield.TextInputLayout>
        
        <!-- Attendees -->
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="Người tham gia"
            android:textSize="14sp"
            android:textColor="#757575"/>
        
        <com.google.android.material.chip.ChipGroup
            android:id="@+id/chipGroupAttendees"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"/>
        
        <Button
            android:id="@+id/btnAddAttendees"
            android:layout_width="wrap_content"
            android:layout_height="36dp"
            android:text="+ Thêm người tham gia"
            android:textSize="13sp"
            style="@style/Widget.MaterialComponents.Button.TextButton"
            app:icon="@drawable/ic_person_add"
            app:iconSize="18dp"/>
        
        <!-- Google Meet integration -->
        <com.google.android.material.card.MaterialCardView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            app:cardBackgroundColor="#E8F5E9"
            app:cardElevation="0dp"
            app:cardCornerRadius="8dp">
            
            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:padding="12dp"
                android:gravity="center_vertical">
                
                <ImageView
                    android:layout_width="32dp"
                    android:layout_height="32dp"
                    android:src="@drawable/ic_google_meet"/>
                
                <LinearLayout
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:layout_marginStart="12dp"
                    android:orientation="vertical">
                    
                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="Tạo Google Meet tự động"
                        android:textSize="14sp"
                        android:textStyle="bold"
                        android:textColor="#2E7D32"/>
                    
                    <TextView
                        android:layout_width="wrap_content"
                        android:layout_height="wrap_content"
                        android:text="Link họp sẽ được gửi tới người tham gia"
                        android:textSize="12sp"
                        android:textColor="#558B2F"/>
                </LinearLayout>
                
                <com.google.android.material.switchmaterial.SwitchMaterial
                    android:id="@+id/switchCreateMeet"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:checked="true"/>
            </LinearLayout>
        </com.google.android.material.card.MaterialCardView>
        
        <!-- Recurring options -->
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="Lặp lại"
            android:textSize="14sp"
            android:textColor="#757575"/>
        
        <Spinner
            android:id="@+id/spinnerRecurrence"
            android:layout_width="match_parent"
            android:layout_height="48dp"
            android:layout_marginTop="8dp"
            android:background="@drawable/spinner_background"/>
        
        <!-- Actions -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="24dp"
            android:orientation="horizontal"
            android:gravity="end">
            
            <Button
                android:id="@+id/btnCancel"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Hủy"
                style="@style/Widget.MaterialComponents.Button.TextButton"/>
            
            <Button
                android:id="@+id/btnCreateEvent"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginStart="8dp"
                android:text="Tạo sự kiện"
                android:backgroundTint="#4CAF50"/>
        </LinearLayout>
    </LinearLayout>
</ScrollView>
```

#### **3.4. ProjectEventsFragment.java**

```java
package com.example.tralalero.feature.home.ui.Home.project;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.tabs.TabLayout;
import com.google.android.material.floatingactionbutton.FloatingActionButton;

public class ProjectEventsFragment extends Fragment {
    private RecyclerView rvEvents;
    private ProjectEventAdapter eventAdapter;
    private TabLayout tabLayoutEvents;
    private View layoutEmptyState;
    
    private ProjectEventsViewModel viewModel;
    private String projectId;
    private EventFilter currentFilter = EventFilter.UPCOMING;
    
    public static ProjectEventsFragment newInstance(String projectId) {
        ProjectEventsFragment fragment = new ProjectEventsFragment();
        Bundle args = new Bundle();
        args.putString("project_id", projectId);
        fragment.setArguments(args);
        return fragment;
    }
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getArguments() != null) {
            projectId = getArguments().getString("project_id");
        }
    }
    
    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                           Bundle savedInstanceState) {
        View view = inflater.inflate(R.layout.fragment_project_events, container, false);
        
        initViews(view);
        setupViewModel();
        setupRecyclerView();
        setupTabs();
        setupButtons(view);
        loadEvents();
        
        return view;
    }
    
    private void initViews(View view) {
        rvEvents = view.findViewById(R.id.rvEvents);
        tabLayoutEvents = view.findViewById(R.id.tabLayoutEvents);
        layoutEmptyState = view.findViewById(R.id.layoutEmptyState);
    }
    
    private void setupViewModel() {
        viewModel = new ViewModelProvider(this).get(ProjectEventsViewModel.class);
    }
    
    private void setupRecyclerView() {
        eventAdapter = new ProjectEventAdapter();
        rvEvents.setLayoutManager(new LinearLayoutManager(getContext()));
        rvEvents.setAdapter(eventAdapter);
        
        // Click handlers
        eventAdapter.setOnEventClickListener(event -> {
            showEventDetails(event);
        });
        
        eventAdapter.setOnJoinMeetingClickListener(event -> {
            joinGoogleMeet(event.getMeetLink());
        });
        
        eventAdapter.setOnCopyLinkClickListener(event -> {
            copyMeetLinkToClipboard(event.getMeetLink());
        });
        
        eventAdapter.setOnMenuClickListener((event, view) -> {
            showEventMenu(event, view);
        });
    }
    
    private void setupTabs() {
        tabLayoutEvents.addOnTabSelectedListener(new TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(TabLayout.Tab tab) {
                int position = tab.getPosition();
                switch (position) {
                    case 0: // Sắp tới
                        currentFilter = EventFilter.UPCOMING;
                        break;
                    case 1: // Đã qua
                        currentFilter = EventFilter.PAST;
                        break;
                    case 2: // Lặp lại
                        currentFilter = EventFilter.RECURRING;
                        break;
                }
                loadEvents();
            }
            
            @Override
            public void onTabUnselected(TabLayout.Tab tab) {}
            
            @Override
            public void onTabReselected(TabLayout.Tab tab) {}
        });
    }
    
    private void setupButtons(View view) {
        // FAB create event
        FloatingActionButton fabCreateEvent = view.findViewById(R.id.fabCreateEvent);
        fabCreateEvent.setOnClickListener(v -> {
            showCreateEventDialog();
        });
        
        // Empty state button
        view.findViewById(R.id.btnCreateFirstEvent).setOnClickListener(v -> {
            showCreateEventDialog();
        });
        
        // Filter button
        view.findViewById(R.id.btnFilterEvents).setOnClickListener(v -> {
            showFilterDialog();
        });
        
        // Search button
        view.findViewById(R.id.btnSearchEvents).setOnClickListener(v -> {
            showSearchDialog();
        });
    }
    
    private void loadEvents() {
        viewModel.loadProjectEvents(projectId, currentFilter)
            .observe(getViewLifecycleOwner(), result -> {
                if (result.isSuccess()) {
                    List<ProjectEvent> events = result.getData();
                    
                    if (events != null && !events.isEmpty()) {
                        eventAdapter.setEvents(events);
                        rvEvents.setVisibility(View.VISIBLE);
                        layoutEmptyState.setVisibility(View.GONE);
                    } else {
                        rvEvents.setVisibility(View.GONE);
                        layoutEmptyState.setVisibility(View.VISIBLE);
                    }
                } else {
                    Toast.makeText(getContext(), 
                        "Lỗi: " + result.getErrorMessage(), 
                        Toast.LENGTH_SHORT).show();
                }
            });
    }
    
    private void showCreateEventDialog() {
        CreateEventDialog dialog = CreateEventDialog.newInstance(projectId);
        dialog.setOnEventCreatedListener(event -> {
            Toast.makeText(getContext(), 
                "✅ Đã tạo sự kiện: " + event.getTitle(), 
                Toast.LENGTH_SHORT).show();
            
            // Reload events
            loadEvents();
            
            // Nếu có Google Meet, hiển thị snackbar với link
            if (event.getMeetLink() != null) {
                showMeetCreatedSnackbar(event);
            }
        });
        dialog.show(getChildFragmentManager(), "create_event");
    }
    
    private void showMeetCreatedSnackbar(ProjectEvent event) {
        Snackbar.make(getView(),
            "📹 Google Meet đã được tạo",
            Snackbar.LENGTH_LONG)
            .setAction("Sao chép link", v -> {
                copyMeetLinkToClipboard(event.getMeetLink());
            })
            .setActionTextColor(Color.parseColor("#4CAF50"))
            .show();
    }
    
    private void joinGoogleMeet(String meetLink) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(meetLink));
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(getContext(), 
                "Không thể mở link họp", 
                Toast.LENGTH_SHORT).show();
        }
    }
    
    private void copyMeetLinkToClipboard(String meetLink) {
        ClipboardManager clipboard = (ClipboardManager) 
            getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("Google Meet Link", meetLink);
        clipboard.setPrimaryClip(clip);
        
        Toast.makeText(getContext(), 
            "✅ Đã sao chép link họp", 
            Toast.LENGTH_SHORT).show();
    }
    
    private void showEventDetails(ProjectEvent event) {
        EventDetailDialog dialog = EventDetailDialog.newInstance(event);
        dialog.show(getChildFragmentManager(), "event_detail");
    }
    
    private void showEventMenu(ProjectEvent event, View anchorView) {
        PopupMenu popup = new PopupMenu(getContext(), anchorView);
        popup.inflate(R.menu.menu_event_actions);
        
        popup.setOnMenuItemClickListener(item -> {
            switch (item.getItemId()) {
                case R.id.action_edit:
                    editEvent(event);
                    return true;
                case R.id.action_cancel:
                    cancelEvent(event);
                    return true;
                case R.id.action_view_in_calendar:
                    openInGoogleCalendar(event);
                    return true;
                case R.id.action_send_reminder:
                    sendReminder(event);
                    return true;
                default:
                    return false;
            }
        });
        
        popup.show();
    }
}
```

---

## 📊 **TỔNG KẾT TRIỂN KHAI**

### **🎨 Giao diện đã đề xuất:**

1. ✅ **CardDetailActivity** - Thêm Calendar Sync section với:
   - Switch bật/tắt đồng bộ
   - Hiển thị trạng thái đồng bộ
   - Settings dialog cho reminders
   - Button xem trong Google Calendar

2. ✅ **Tab Calendar** - Giao diện lịch đầy đủ:
   - MaterialCalendarView với color coding
   - View mode: Tuần/Tháng
   - Filter và export options
   - Danh sách events theo ngày
   - Sync với Google Calendar

3. ✅ **Tab Event** - Quản lý meetings:
   - Tabs: Sắp tới/Đã qua/Lặp lại
   - Create event dialog với Google Meet
   - Event item với join meeting button
   - Recurring events support

### **🔧 Backend APIs cần triển khai:**

```typescript
// Google Calendar endpoints
GET  /api/google-auth/status          // Kiểm tra connection status
GET  /api/google-auth/auth-url        // Lấy OAuth URL
GET  /api/google-auth/callback        // OAuth callback
POST /api/google-auth/disconnect      // Ngắt kết nối

// Calendar events endpoints  
GET    /api/projects/:id/calendar     // Lấy events của project
POST   /api/calendar/events           // Tạo event mới
PUT    /api/calendar/events/:id       // Cập nhật event
DELETE /api/calendar/events/:id       // Xóa event
POST   /api/calendar/sync             // Đồng bộ thủ công

// Task calendar integration
POST /api/tasks                       // Tạo task (có calendar sync)
PUT  /api/tasks/:id                   // Cập nhật task (sync calendar)
DELETE /api/tasks/:id                 // Xóa task (xóa calendar event)
```

### **📱 Android Services cần triển khai:**

```java
// API Services
GoogleAuthApiService.java            // OAuth flow APIs
GoogleCalendarApiService.java        // Calendar CRUD APIs
ProjectEventsApiService.java         // Project events APIs

// ViewModels
ProjectCalendarViewModel.java        // Calendar tab logic
ProjectEventsViewModel.java          // Events tab logic
CalendarSyncViewModel.java           // Sync management

// Adapters
CalendarEventAdapter.java            // Calendar events list
ProjectEventAdapter.java             // Project events list

// Dialogs
CalendarReminderSettingsDialog.java  // Reminder settings
CreateEventDialog.java               // Create event form
EventDetailDialog.java               // Event details
CalendarFilterDialog.java            // Filter options

// Utilities
CalendarSyncManager.java             // Background sync
EventDecorator.java                  // Calendar decorators
GoogleMeetHelper.java                // Google Meet integration
```

---

**📚 Tài liệu này cung cấp:**
- ✅ Phân tích chi tiết giao diện hiện tại (project_main.xml, CardDetailActivity)
- ✅ Đề xuất UI/UX mới cho 3 tabs: Board, Calendar, Event
- ✅ Code mẫu đầy đủ XML layouts với Material Design
- ✅ Code mẫu Java cho Activities, Fragments, Adapters
- ✅ Code mẫu TypeScript cho Backend NestJS services
- ✅ Integration flow từ Android → Backend → Google Calendar API
- ✅ Error handling và user feedback chi tiết
- ✅ Google Meet integration cho meetings
- ✅ Recurring events support

Bạn có muốn tôi tiếp tục với các use case nâng cao khác như Daily Standup Automation, Sprint Planning, hay Location-based Reminders không?
