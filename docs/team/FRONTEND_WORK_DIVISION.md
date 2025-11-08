# 👥 Frontend Work Division - Calendar Integration Sprint

**Sprint Duration:** Week 1 (Nov 8-15, 2025)  
**Team:** 2 Frontend Developers  
**Backend Status:** ✅ 100% Complete (All APIs ready)

---

## 🎯 Team Structure

### Dev1 - Logic & Integration Specialist

**Primary Focus:** Business logic, API integration, data layer

**Skills:**

- ✅ Retrofit API integration
- ✅ Model class creation
- ✅ ViewModel & state management
- ✅ Repository pattern
- ✅ Kotlin Coroutines/Flow

**Responsibilities:**

- API service interfaces
- Data models & DTOs
- ViewModels & business logic
- Repository implementations
- LiveData/StateFlow management
- Error handling & validation

---

### Dev2 - UI/UX Specialist

**Primary Focus:** User interface, layouts, user interactions

**Skills:**

- ✅ XML layouts & Material Design
- ✅ Custom views & adapters
- ✅ Fragment & Dialog management
- ✅ Animations & transitions
- ✅ View binding

**Responsibilities:**

- XML layout design
- Custom adapters (RecyclerView)
- Dialogs & bottom sheets
- Fragment implementations
- UI animations & transitions
- Theme & styling

---

## 📋 Work Division by Feature

### 🔴 Priority 1: Meeting Scheduler (3 days)

#### Dev1 - Logic Tasks (12-16 hours)

**1. API Service Layer** ⏱️ 3 hours

```kotlin
// File: app/src/main/java/com/plantracker/api/MeetingSchedulerApiService.kt
interface MeetingSchedulerApiService {
    @POST("calendar/meetings/suggest-times")
    suspend fun suggestMeetingTimes(@Body request: SuggestMeetingTimeRequest): MeetingTimeSuggestion

    @POST("calendar/meetings/create")
    suspend fun createMeeting(@Body request: CreateMeetingRequest): MeetingResponse
}
```

**Tasks:**

- [ ] Create API interface with Retrofit
- [ ] Setup error handling
- [ ] Add logging interceptor
- [ ] Test with Postman/HTTP client

**Dependencies:** Backend APIs (✅ Ready)

---

**2. Model Classes** ⏱️ 2 hours

```kotlin
// Files: app/src/main/java/com/plantracker/model/calendar/

data class SuggestMeetingTimeRequest(
    val userIds: List<String>,
    val startDate: String,
    val endDate: String,
    val durationMinutes: Int,
    val maxSuggestions: Int = 5
)

data class TimeSlot(
    val startTime: String,
    val endTime: String,
    val score: Double,
    val availableUsers: List<String>
) {
    fun getFormattedDate(): String { /* format logic */ }
    fun getFormattedTimeRange(): String { /* format logic */ }
    fun getScoreBadge(): String { /* "Excellent" | "Good" | "Fair" */ }
}

data class MeetingTimeSuggestion(
    val suggestions: List<TimeSlot>,
    val requestedDuration: Int
)

data class CreateMeetingRequest(
    val organizerId: String,
    val attendeeIds: List<String>,
    val timeSlot: TimeSlot,
    val summary: String,
    val description: String?
)

data class MeetingResponse(
    val id: String,
    val title: String,
    val startAt: String,
    val endAt: String,
    val meetLink: String?,
    val participants: List<Participant>
)
```

**Tasks:**

- [ ] Create all model classes with @Serializable
- [ ] Add helper methods (formatting, validation)
- [ ] Write unit tests for formatters
- [ ] Document each class

**Note:** Some classes already exist, verify and update if needed

---

**3. Repository Layer** ⏱️ 4 hours

```kotlin
// File: app/src/main/java/com/plantracker/repository/CalendarRepository.kt

class CalendarRepository @Inject constructor(
    private val apiService: MeetingSchedulerApiService,
    private val errorHandler: ApiErrorHandler
) {
    suspend fun suggestMeetingTimes(
        userIds: List<String>,
        startDate: LocalDate,
        endDate: LocalDate,
        durationMinutes: Int
    ): Result<MeetingTimeSuggestion> {
        return try {
            val request = SuggestMeetingTimeRequest(
                userIds = userIds,
                startDate = startDate.toString(),
                endDate = endDate.toString(),
                durationMinutes = durationMinutes
            )
            val response = apiService.suggestMeetingTimes(request)
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(errorHandler.handle(e))
        }
    }

    suspend fun createMeeting(
        organizerId: String,
        attendeeIds: List<String>,
        timeSlot: TimeSlot,
        summary: String,
        description: String? = null
    ): Result<MeetingResponse> {
        // Implementation
    }
}
```

**Tasks:**

- [ ] Create repository class
- [ ] Implement error handling with Result/Either
- [ ] Add retry logic for network errors
- [ ] Write repository tests with MockWebServer

---

**4. ViewModel** ⏱️ 5 hours

```kotlin
// File: app/src/main/java/com/plantracker/viewmodel/MeetingSchedulerViewModel.kt

@HiltViewModel
class MeetingSchedulerViewModel @Inject constructor(
    private val repository: CalendarRepository,
    private val projectRepository: ProjectRepository
) : ViewModel() {

    private val _selectedMembers = MutableStateFlow<List<User>>(emptyList())
    val selectedMembers: StateFlow<List<User>> = _selectedMembers.asStateFlow()

    private val _suggestedTimes = MutableStateFlow<List<TimeSlot>>(emptyList())
    val suggestedTimes: StateFlow<List<TimeSlot>> = _suggestedTimes.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun suggestTimes(durationMinutes: Int, startDate: LocalDate, endDate: LocalDate) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null

            repository.suggestMeetingTimes(
                userIds = _selectedMembers.value.map { it.id },
                startDate = startDate,
                endDate = endDate,
                durationMinutes = durationMinutes
            ).fold(
                onSuccess = { _suggestedTimes.value = it.suggestions },
                onFailure = { _error.value = it.message }
            )

            _isLoading.value = false
        }
    }

    fun createMeeting(timeSlot: TimeSlot, title: String, description: String?) {
        // Implementation
    }

    fun toggleMemberSelection(user: User) {
        // Implementation
    }
}
```

**Tasks:**

- [ ] Create ViewModel with StateFlow
- [ ] Implement all business logic methods
- [ ] Add input validation
- [ ] Write ViewModel tests

---

#### Dev2 - UI Tasks (12-16 hours)

**1. Member Selection Bottom Sheet** ⏱️ 4 hours

**Layout:** `fragment_member_selection.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Select Team Members"
        android:textSize="20sp"
        android:textStyle="bold" />

    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/memberRecyclerView"
        android:layout_width="match_parent"
        android:layout_height="300dp"
        android:layout_marginTop="16dp" />

    <Button
        android:id="@+id/btnNext"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Next"
        android:layout_marginTop="16dp" />
</LinearLayout>
```

**Adapter:** `MemberSelectionAdapter.kt`

```kotlin
class MemberSelectionAdapter(
    private val onMemberClick: (User) -> Unit
) : RecyclerView.Adapter<MemberSelectionAdapter.ViewHolder>() {

    private var members = emptyList<User>()
    private val selectedIds = mutableSetOf<String>()

    // Implementation
}
```

**Tasks:**

- [ ] Design bottom sheet layout
- [ ] Create member item layout with checkbox
- [ ] Implement adapter with selection state
- [ ] Add animations for selection
- [ ] Test with different screen sizes

---

**2. Time Slot Selection Dialog** ⏱️ 5 hours

**Layout:** `dialog_meeting_scheduler.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout>

    <!-- Header -->
    <TextView
        android:id="@+id/tvTitle"
        android:text="Suggested Meeting Times"
        android:textSize="18sp"
        android:textStyle="bold" />

    <!-- Duration selector -->
    <com.google.android.material.textfield.TextInputLayout
        android:id="@+id/tilDuration"
        style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox"
        android:hint="Duration (minutes)">

        <com.google.android.material.textfield.TextInputEditText
            android:id="@+id/etDuration"
            android:inputType="number"
            android:text="60" />
    </com.google.android.material.textfield.TextInputLayout>

    <!-- Date range picker -->
    <Button
        android:id="@+id/btnSelectDateRange"
        android:text="Select Date Range" />

    <!-- Suggest button -->
    <Button
        android:id="@+id/btnSuggest"
        android:text="Find Available Times" />

    <!-- Loading indicator -->
    <ProgressBar
        android:id="@+id/progressBar"
        android:visibility="gone" />

    <!-- Results RecyclerView -->
    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/rvSuggestions"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:visibility="gone" />

</androidx.constraintlayout.widget.ConstraintLayout>
```

**Item Layout:** `item_time_slot.xml`

```xml
<com.google.android.material.card.MaterialCardView
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    app:cardElevation="2dp"
    app:cardCornerRadius="8dp">

    <LinearLayout
        android:orientation="horizontal"
        android:padding="16dp">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_weight="1"
            android:orientation="vertical">

            <TextView
                android:id="@+id/tvDate"
                android:text="Monday, Nov 11"
                android:textSize="16sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/tvTime"
                android:text="2:00 PM - 3:00 PM"
                android:textSize="14sp" />

            <TextView
                android:id="@+id/tvAvailability"
                android:text="3 of 4 available"
                android:textSize="12sp"
                android:textColor="@color/text_secondary" />
        </LinearLayout>

        <com.google.android.material.chip.Chip
            android:id="@+id/chipScore"
            android:text="Excellent"
            android:textColor="@android:color/white"
            android:chipBackgroundColor="@color/green_500" />
    </LinearLayout>
</com.google.android.material.card.MaterialCardView>
```

**Tasks:**

- [ ] Design main dialog layout
- [ ] Create time slot item layout
- [ ] Implement date range picker integration
- [ ] Add loading states & animations
- [ ] Handle empty states
- [ ] Test with different data scenarios

---

**3. Suggested Times Adapter** ⏱️ 3 hours

```kotlin
// File: app/src/main/java/com/plantracker/adapter/SuggestedTimeSlotsAdapter.kt

class SuggestedTimeSlotsAdapter(
    private val onTimeSlotClick: (TimeSlot) -> Unit
) : ListAdapter<TimeSlot, SuggestedTimeSlotsAdapter.ViewHolder>(TimeSlotDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemTimeSlotBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(private val binding: ItemTimeSlotBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(timeSlot: TimeSlot) {
            binding.tvDate.text = timeSlot.getFormattedDate()
            binding.tvTime.text = timeSlot.getFormattedTimeRange()
            binding.tvAvailability.text = "${timeSlot.availableUsers.size} available"

            // Set chip color based on score
            binding.chipScore.apply {
                text = timeSlot.getScoreBadge()
                chipBackgroundColor = ColorStateList.valueOf(
                    when {
                        timeSlot.score >= 80 -> Color.parseColor("#4CAF50") // Green
                        timeSlot.score >= 60 -> Color.parseColor("#FF9800") // Orange
                        else -> Color.parseColor("#F44336") // Red
                    }
                )
            }

            binding.root.setOnClickListener {
                onTimeSlotClick(timeSlot)
            }
        }
    }
}

class TimeSlotDiffCallback : DiffUtil.ItemCallback<TimeSlot>() {
    override fun areItemsTheSame(oldItem: TimeSlot, newItem: TimeSlot) =
        oldItem.startTime == newItem.startTime

    override fun areContentsTheSame(oldItem: TimeSlot, newItem: TimeSlot) =
        oldItem == newItem
}
```

**Tasks:**

- [ ] Implement adapter with DiffUtil
- [ ] Add click handling
- [ ] Implement score-based color coding
- [ ] Add item animations
- [ ] Test with different time slot data

---

**4. Meeting Confirmation Dialog** ⏱️ 3 hours

**Layout:** `dialog_meeting_confirm.xml`

```xml
<LinearLayout
    android:orientation="vertical"
    android:padding="24dp">

    <TextView
        android:text="Create Meeting"
        android:textSize="20sp"
        android:textStyle="bold" />

    <!-- Selected time display -->
    <com.google.android.material.card.MaterialCardView
        android:layout_marginTop="16dp"
        app:cardBackgroundColor="@color/primary_light">

        <LinearLayout android:padding="16dp">
            <ImageView
                android:src="@drawable/ic_calendar"
                android:tint="@color/primary" />

            <LinearLayout android:layout_marginStart="12dp">
                <TextView
                    android:id="@+id/tvSelectedDate"
                    android:text="Monday, Nov 11"
                    android:textStyle="bold" />
                <TextView
                    android:id="@+id/tvSelectedTime"
                    android:text="2:00 PM - 3:00 PM" />
            </LinearLayout>
        </LinearLayout>
    </com.google.android.material.card.MaterialCardView>

    <!-- Meeting title -->
    <com.google.android.material.textfield.TextInputLayout
        android:hint="Meeting Title"
        android:layout_marginTop="16dp">

        <com.google.android.material.textfield.TextInputEditText
            android:id="@+id/etTitle"
            android:inputType="text" />
    </com.google.android.material.textfield.TextInputLayout>

    <!-- Description (optional) -->
    <com.google.android.material.textfield.TextInputLayout
        android:hint="Description (optional)"
        android:layout_marginTop="8dp">

        <com.google.android.material.textfield.TextInputEditText
            android:id="@+id/etDescription"
            android:inputType="textMultiLine"
            android:lines="3" />
    </com.google.android.material.textfield.TextInputLayout>

    <!-- Google Meet toggle -->
    <com.google.android.material.switchmaterial.SwitchMaterial
        android:id="@+id/switchGoogleMeet"
        android:text="Add Google Meet link"
        android:checked="true"
        android:layout_marginTop="16dp" />

    <!-- Action buttons -->
    <LinearLayout
        android:orientation="horizontal"
        android:layout_marginTop="24dp">

        <Button
            android:id="@+id/btnCancel"
            style="@style/Widget.MaterialComponents.Button.OutlinedButton"
            android:text="Cancel"
            android:layout_weight="1" />

        <Button
            android:id="@+id/btnCreate"
            android:text="Create Meeting"
            android:layout_weight="1"
            android:layout_marginStart="8dp" />
    </LinearLayout>
</LinearLayout>
```

**Tasks:**

- [ ] Design confirmation dialog
- [ ] Add input validation
- [ ] Implement create meeting flow
- [ ] Add success/error snackbars
- [ ] Test with different inputs

---

#### Integration Tasks (Shared - 2 hours)

**Dev1:**

- [ ] Wire ViewModel to UI
- [ ] Setup dependency injection (Hilt)
- [ ] Add error handling integration
- [ ] Write integration tests

**Dev2:**

- [ ] Connect adapters to ViewModel data
- [ ] Implement navigation flow
- [ ] Add accessibility features
- [ ] Polish animations & transitions

---

### 🟡 Priority 2: Quick Event Creation (2 days)

#### Dev1 - Logic Tasks (6-8 hours)

**1. Event API Service** ⏱️ 2 hours

```kotlin
interface EventApiService {
    @POST("events/projects")
    suspend fun createEvent(@Body request: CreateEventRequest): EventResponse

    @PATCH("events/projects/{id}")
    suspend fun updateEvent(@Path("id") id: String, @Body request: UpdateEventRequest): EventResponse

    @DELETE("events/projects/{id}")
    suspend fun deleteEvent(@Path("id") id: String): DeleteResponse
}
```

**2. Event Models** ⏱️ 2 hours

```kotlin
data class CreateEventRequest(
    val projectId: String,
    val title: String,
    val description: String?,
    val date: String,
    val time: String,
    val duration: Int,
    val type: EventType,
    val recurrence: RecurrenceType,
    val attendeeIds: List<String>,
    val createGoogleMeet: Boolean
)

enum class EventType {
    MEETING, MILESTONE, OTHER
}

enum class RecurrenceType {
    NONE, DAILY, WEEKLY, BIWEEKLY, MONTHLY
}
```

**3. Event Repository & ViewModel** ⏱️ 4 hours

**Tasks:**

- [ ] Create EventRepository
- [ ] Implement QuickEventViewModel
- [ ] Add form validation logic
- [ ] Handle recurring event logic

---

#### Dev2 - UI Tasks (6-8 hours)

**1. Quick Event Dialog** ⏱️ 5 hours

**Layout:** `dialog_quick_event.xml`

```xml
<ScrollView>
    <LinearLayout android:orientation="vertical" android:padding="16dp">

        <TextView
            android:text="Quick Event"
            android:textSize="20sp"
            android:textStyle="bold" />

        <!-- Title -->
        <com.google.android.material.textfield.TextInputLayout
            android:hint="Event Title">
            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etTitle" />
        </com.google.android.material.textfield.TextInputLayout>

        <!-- Date picker -->
        <com.google.android.material.textfield.TextInputLayout
            android:hint="Date">
            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etDate"
                android:focusable="false"
                android:clickable="true" />
        </com.google.android.material.textfield.TextInputLayout>

        <!-- Time picker -->
        <com.google.android.material.textfield.TextInputLayout
            android:hint="Time">
            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etTime"
                android:focusable="false"
                android:clickable="true" />
        </com.google.android.material.textfield.TextInputLayout>

        <!-- Duration spinner -->
        <com.google.android.material.textfield.TextInputLayout
            android:hint="Duration"
            style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox.ExposedDropdownMenu">
            <AutoCompleteTextView
                android:id="@+id/actvDuration"
                android:text="30 minutes" />
        </com.google.android.material.textfield.TextInputLayout>

        <!-- Event type chips -->
        <com.google.android.material.chip.ChipGroup
            android:id="@+id/chipGroupType"
            app:singleSelection="true"
            android:layout_marginTop="8dp">

            <com.google.android.material.chip.Chip
                android:id="@+id/chipMeeting"
                android:text="Meeting"
                android:checked="true"
                style="@style/Widget.MaterialComponents.Chip.Choice" />

            <com.google.android.material.chip.Chip
                android:id="@+id/chipMilestone"
                android:text="Milestone"
                style="@style/Widget.MaterialComponents.Chip.Choice" />

            <com.google.android.material.chip.Chip
                android:id="@+id/chipOther"
                android:text="Other"
                style="@style/Widget.MaterialComponents.Chip.Choice" />
        </com.google.android.material.chip.ChipGroup>

        <!-- Google Meet toggle -->
        <com.google.android.material.switchmaterial.SwitchMaterial
            android:id="@+id/switchGoogleMeet"
            android:text="Add Google Meet"
            android:checked="true" />

        <!-- Recurring options (expandable) -->
        <TextView
            android:id="@+id/tvRecurringOptions"
            android:text="Recurring Options ▼"
            android:clickable="true"
            android:textColor="@color/primary" />

        <RadioGroup
            android:id="@+id/rgRecurrence"
            android:visibility="gone">
            <RadioButton android:text="None" android:checked="true" />
            <RadioButton android:text="Daily" />
            <RadioButton android:text="Weekly" />
            <RadioButton android:text="Bi-weekly" />
            <RadioButton android:text="Monthly" />
        </RadioGroup>

        <!-- Buttons -->
        <LinearLayout android:orientation="horizontal">
            <Button
                android:id="@+id/btnCancel"
                android:text="Cancel"
                style="@style/Widget.MaterialComponents.Button.OutlinedButton"
                android:layout_weight="1" />

            <Button
                android:id="@+id/btnCreate"
                android:text="Create"
                android:layout_weight="1" />
        </LinearLayout>
    </LinearLayout>
</ScrollView>
```

**Tasks:**

- [ ] Design quick event dialog
- [ ] Implement date/time pickers
- [ ] Add duration dropdown
- [ ] Create expandable recurring section
- [ ] Add form validation UI feedback

**2. Calendar Tab FAB** ⏱️ 2 hours

- [ ] Add FAB to Calendar tab
- [ ] Implement FAB animation
- [ ] Connect to QuickEventDialog

---

### 🟢 Priority 3: Project Summary Widgets (1.5 days)

#### Dev1 - Logic Tasks (4-6 hours)

**1. Summary API Service** ⏱️ 1 hour

```kotlin
interface ProjectApiService {
    @GET("projects/{id}/summary")
    suspend fun getProjectSummary(@Path("id") projectId: String): ProjectSummaryResponse
}

data class ProjectSummaryResponse(
    val done: Int,
    val updated: Int,
    val created: Int,
    val due: Int,
    val statusOverview: StatusOverview
)

data class StatusOverview(
    val period: String,
    val total: Int,
    val toDo: Int,
    val inProgress: Int,
    val inReview: Int,
    val done: Int
)
```

**2. Summary Repository & ViewModel** ⏱️ 3 hours

```kotlin
class ProjectSummaryViewModel @Inject constructor(
    private val repository: ProjectRepository
) : ViewModel() {

    private val _summary = MutableStateFlow<ProjectSummaryResponse?>(null)
    val summary: StateFlow<ProjectSummaryResponse?> = _summary.asStateFlow()

    fun loadSummary(projectId: String) {
        viewModelScope.launch {
            repository.getProjectSummary(projectId)
                .onSuccess { _summary.value = it }
                .onFailure { /* handle error */ }
        }
    }
}
```

**Tasks:**

- [ ] Create API interface
- [ ] Implement repository
- [ ] Create ViewModel with refresh logic
- [ ] Add caching strategy

---

#### Dev2 - UI Tasks (6-8 hours)

**1. Summary Widgets** ⏱️ 4 hours

**Layout:** `fragment_project_summary.xml`

```xml
<ScrollView>
    <LinearLayout android:orientation="vertical">

        <!-- 4 stat cards grid -->
        <GridLayout
            android:columnCount="2"
            android:rowCount="2">

            <!-- Done widget -->
            <com.google.android.material.card.MaterialCardView>
                <LinearLayout android:padding="16dp">
                    <ImageView
                        android:src="@drawable/ic_check_circle"
                        android:tint="@color/green_500" />
                    <LinearLayout>
                        <TextView
                            android:id="@+id/tvDoneCount"
                            android:text="0"
                            android:textSize="24sp"
                            android:textStyle="bold" />
                        <TextView
                            android:text="done"
                            android:textSize="12sp" />
                        <TextView
                            android:text="in the last 7 days"
                            android:textSize="10sp"
                            android:textColor="@color/text_secondary" />
                    </LinearLayout>
                </LinearLayout>
            </com.google.android.material.card.MaterialCardView>

            <!-- Updated widget (same pattern) -->
            <!-- Created widget (same pattern) -->
            <!-- Due widget (same pattern) -->
        </GridLayout>

        <!-- Status overview card -->
        <com.google.android.material.card.MaterialCardView
            android:layout_marginTop="16dp">
            <LinearLayout android:padding="16dp">

                <TextView
                    android:text="Status overview"
                    android:textSize="18sp"
                    android:textStyle="bold" />

                <TextView
                    android:text="in the last 14 days"
                    android:textSize="12sp"
                    android:textColor="@color/text_secondary" />

                <!-- Donut chart -->
                <com.github.mikephil.charting.charts.PieChart
                    android:id="@+id/chartStatus"
                    android:layout_width="200dp"
                    android:layout_height="200dp"
                    android:layout_gravity="center"
                    android:layout_marginTop="16dp" />

                <!-- Status legend -->
                <LinearLayout android:orientation="horizontal">
                    <LinearLayout>
                        <View
                            android:background="@color/status_todo"
                            android:layout_width="16dp"
                            android:layout_height="16dp" />
                        <TextView
                            android:id="@+id/tvToDoCount"
                            android:text="To Do: 3" />
                    </LinearLayout>
                    <!-- In Progress, In Review, Done legends -->
                </LinearLayout>
            </LinearLayout>
        </com.google.android.material.card.MaterialCardView>

    </LinearLayout>
</ScrollView>
```

**Tasks:**

- [ ] Create 4 stat widget layouts
- [ ] Implement donut chart with MPAndroidChart
- [ ] Add pull-to-refresh
- [ ] Handle loading/empty states
- [ ] Add animations for count updates

**2. Integration** ⏱️ 2 hours

- [ ] Connect to ViewModel
- [ ] Implement data binding
- [ ] Add shimmer loading effect
- [ ] Test with different data

---

## 📊 Timeline & Dependencies

### Week 1 Schedule

**Day 1-2 (Nov 8-9):**

- Dev1: API services + Models (Meeting Scheduler)
- Dev2: Member selection UI + Time slot layouts

**Day 3 (Nov 10):**

- Dev1: Repository + ViewModel
- Dev2: Dialogs + Adapters
- **Integration:** Wire ViewModel to UI

**Day 4-5 (Nov 11-12):**

- Dev1: Quick Event logic layer
- Dev2: Quick Event UI + FAB
- **Testing:** E2E meeting scheduler

**Day 6-7 (Nov 13-14):**

- Dev1: Summary API + ViewModel
- Dev2: Summary widgets + chart
- **Polish:** All features

**Day 8 (Nov 15):**

- **Joint:** Integration testing
- **Joint:** Bug fixes & polish
- **Joint:** Demo preparation

---

## 🔄 Workflow & Communication

### Daily Standup (15 min)

- ✅ What did you complete yesterday?
- 🎯 What are you working on today?
- ⚠️ Any blockers?

### Code Review Process

1. Dev1 reviews Dev2's UI code
2. Dev2 reviews Dev1's logic code
3. Pair review for integration code

### Branch Strategy

```
develop
  ├── feature/meeting-scheduler-logic (Dev1)
  ├── feature/meeting-scheduler-ui (Dev2)
  ├── feature/quick-event-logic (Dev1)
  ├── feature/quick-event-ui (Dev2)
  └── feature/summary-widgets (Both)
```

### Merge Strategy

1. Complete feature branch
2. Create PR with description
3. Code review + approval
4. Merge to develop
5. Test on develop branch

---

## 📝 Checklist Templates

### Dev1 - Feature Checklist

- [ ] API interface created
- [ ] Models with serialization
- [ ] Repository implementation
- [ ] ViewModel with StateFlow
- [ ] Error handling
- [ ] Unit tests (80%+ coverage)
- [ ] Documentation (KDoc)
- [ ] Code review requested

### Dev2 - Feature Checklist

- [ ] XML layouts created
- [ ] Adapters implemented
- [ ] Dialogs/Fragments created
- [ ] View binding setup
- [ ] Accessibility labels
- [ ] UI tests (Espresso)
- [ ] Screenshots for documentation
- [ ] Code review requested

---

## 🎯 Success Criteria

### Meeting Scheduler

- ✅ User can select team members
- ✅ User can specify duration and date range
- ✅ System suggests 3-5 time slots with scores
- ✅ User can create meeting with Meet link
- ✅ Notifications sent to attendees

### Quick Event

- ✅ User can create event in <30 seconds
- ✅ Google Meet optional
- ✅ Recurring events support
- ✅ Syncs to Google Calendar

### Project Summary

- ✅ Shows 4 stat widgets (done/updated/created/due)
- ✅ Displays status donut chart
- ✅ Updates in real-time
- ✅ Pull-to-refresh works

---

## 📚 Resources

### Dev1 Resources

- [Backend API Docs](../integration/DEVELOPER_GUIDE_BACKEND.md)
- [Retrofit Guide](https://square.github.io/retrofit/)
- [Kotlin Coroutines](https://kotlinlang.org/docs/coroutines-overview.html)
- [Hilt DI](https://developer.android.com/training/dependency-injection/hilt-android)

### Dev2 Resources

- [Material Design](https://material.io/components)
- [RecyclerView Guide](https://developer.android.com/guide/topics/ui/layout/recyclerview)
- [MPAndroidChart](https://github.com/PhilJay/MPAndroidChart)
- [View Binding](https://developer.android.com/topic/libraries/view-binding)

### Test Scripts

- [Backend Test APIs](../../_test-scripts/test-summary-rsvp.http)

---

## ⚠️ Important Notes

### Backend Dependencies

- ✅ All APIs ready (100% complete)
- ✅ OAuth already integrated
- ✅ Notifications system working
- ✅ Test data available

### Known Limitations

- ⚠️ RSVP auto-sync from Google Calendar not implemented (manual update only)
- ⚠️ Free/Busy API requires Google Calendar OAuth
- ℹ️ Project Summary simplified (no complex analytics)

### Performance Considerations

- Use pagination for large member lists
- Cache summary data (refresh every 5 minutes)
- Lazy load calendar events
- Optimize RecyclerView with DiffUtil

---

**Questions?** Check [QUICK_STATUS.md](../status/QUICK_STATUS.md) or ask in team chat!

**Last Updated:** November 8, 2025  
**Next Review:** After Day 3 (Integration checkpoint)
