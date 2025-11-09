# 🚨 URGENT: Dev2 Recovery Plan

**Status:** 🔴 Only 12% completed (3/26 hours)  
**Deadline:** November 15, 2025 (6 days left)  
**Required:** Complete 88% remaining work (23 hours)

---

## 📋 Missing Deliverables Checklist

### 🔴 Priority 1: Meeting Scheduler UI (12-16 hours) - MUST COMPLETE

#### Day 1 (Nov 10) - 6 hours

- [ ] **Layout:** `res/layout/dialog_meeting_scheduler.xml`
  - Duration input field
  - Date range picker button
  - "Find Times" button
  - RecyclerView for results
  - ProgressBar for loading
- [ ] **Layout:** `res/layout/item_time_slot.xml`
  - Date TextView
  - Time range TextView
  - Availability TextView
  - Score chip (Green/Orange/Red)

- [ ] **Adapter:** `MemberSelectionAdapter.java`
  - RecyclerView.Adapter with checkbox
  - Multi-selection support
  - Use DiffUtil

**Files to create:**

```
app/src/main/res/layout/
├── dialog_meeting_scheduler.xml
├── item_time_slot.xml
└── bottom_sheet_member_selection.xml

app/src/main/java/.../feature/home/ui/Home/calendar/
├── MemberSelectionAdapter.java
└── MemberSelectionBottomSheet.java
```

#### Day 2 (Nov 11) - 6 hours

- [ ] **Adapter:** `SuggestedTimeSlotsAdapter.java`
  - Use ListAdapter<TimeSlot, ViewHolder>
  - Implement DiffUtil.ItemCallback
  - Color-code chips by score (80+%=Green, 60+%=Orange, <60%=Red)
  - Add click listener for selection

- [ ] **Layout:** `dialog_meeting_confirm.xml`
  - Selected time display card
  - Title input field
  - Description input (optional)
  - Google Meet toggle
  - Create + Cancel buttons

- [ ] **Dialog:** `MeetingSchedulerDialog.java` or Fragment
  - Wire ViewModel (already exists)
  - Connect adapters
  - Handle date picker
  - Handle time slot selection
  - Show confirmation dialog

**Code Template:**

```java
public class SuggestedTimeSlotsAdapter extends ListAdapter<TimeSlot, SuggestedTimeSlotsAdapter.ViewHolder> {
    private OnTimeSlotClickListener listener;

    public SuggestedTimeSlotsAdapter(OnTimeSlotClickListener listener) {
        super(DIFF_CALLBACK);
        this.listener = listener;
    }

    @Override
    public ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
            .inflate(R.layout.item_time_slot, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(ViewHolder holder, int position) {
        TimeSlot slot = getItem(position);
        holder.bind(slot, listener);
    }

    class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvDate, tvTime, tvAvailability;
        Chip chipScore;

        void bind(TimeSlot slot, OnTimeSlotClickListener listener) {
            tvDate.setText(slot.getFormattedDate());
            tvTime.setText(slot.getFormattedTimeRange());
            tvAvailability.setText(slot.getAvailableUsers().size() + " available");
            chipScore.setText(slot.getScoreBadge());

            // Color based on score
            int color = slot.getScore() >= 80 ? Color.parseColor("#4CAF50") :
                       slot.getScore() >= 60 ? Color.parseColor("#FF9800") :
                       Color.parseColor("#F44336");
            chipScore.setChipBackgroundColor(ColorStateList.valueOf(color));

            itemView.setOnClickListener(v -> listener.onTimeSlotClick(slot));
        }
    }

    static final DiffUtil.ItemCallback<TimeSlot> DIFF_CALLBACK =
        new DiffUtil.ItemCallback<TimeSlot>() {
            @Override
            public boolean areItemsTheSame(@NonNull TimeSlot old, @NonNull TimeSlot newItem) {
                return old.getStart().equals(newItem.getStart());
            }

            @Override
            public boolean areContentsTheSame(@NonNull TimeSlot old, @NonNull TimeSlot newItem) {
                return old.getScore() == newItem.getScore();
            }
        };

    interface OnTimeSlotClickListener {
        void onTimeSlotClick(TimeSlot slot);
    }
}
```

---

### 🟡 Priority 2: Quick Event UI (6-8 hours) - HIGH

#### Day 3 (Nov 12) - 6 hours

- [ ] **Layout:** `dialog_quick_event.xml`
  - Title input
  - Date picker
  - Time picker
  - Duration dropdown (15/30/60/120 min)
  - Event type chips (Meeting/Milestone/Other)
  - Google Meet toggle
  - Recurring options (expandable)
  - Create + Cancel buttons

- [ ] **Dialog:** `QuickEventDialog.java`
  - Extend DialogFragment
  - Wire to QuickEventViewModel (already exists)
  - Handle date/time pickers
  - Validate inputs
  - Show success/error messages

- [ ] **FAB:** Add to Calendar tab
  - FloatingActionButton in calendar layout
  - onClick → show QuickEventDialog
  - Material Design 3 style

**Code Template:**

```java
public class QuickEventDialog extends DialogFragment {
    private QuickEventViewModel viewModel;
    private String projectId;

    @Override
    public Dialog onCreateDialog(Bundle savedInstanceState) {
        View view = LayoutInflater.from(getContext())
            .inflate(R.layout.dialog_quick_event, null);

        viewModel = new ViewModelProvider(this).get(QuickEventViewModel.class);

        // Setup views
        TextInputEditText etTitle = view.findViewById(R.id.etTitle);
        TextInputEditText etDate = view.findViewById(R.id.etDate);
        // ... more views

        // Date picker
        etDate.setOnClickListener(v -> showDatePicker());

        // Create button
        Button btnCreate = view.findViewById(R.id.btnCreate);
        btnCreate.setOnClickListener(v -> {
            String title = etTitle.getText().toString();
            // Validate + create event
            viewModel.createEvent(projectId, title, ...);
        });

        // Observe result
        viewModel.getEventCreated().observe(this, event -> {
            Toast.makeText(getContext(), "Event created!", Toast.LENGTH_SHORT).show();
            dismiss();
        });

        return new AlertDialog.Builder(requireContext())
            .setView(view)
            .create();
    }
}
```

---

### 🟢 Priority 3: Project Summary Widgets (4-6 hours) - MEDIUM

#### Day 4 (Nov 13) - 5 hours

- [ ] **Layout:** `fragment_project_summary.xml` (complete it)
  - 4 stat cards in 2x2 grid
  - Each card: Icon + Count + Label + Description
  - Status overview card with chart
  - Pull-to-refresh layout

- [ ] **Chart:** Implement donut chart
  - Use MPAndroidChart library
  - 4 sections: TO_DO, IN_PROGRESS, IN_REVIEW, DONE
  - Color scheme: #9E9E9E, #2196F3, #FF9800, #4CAF50
  - Legend below chart

- [ ] **Refresh:** SwipeRefreshLayout
  - Wrap entire layout
  - Call viewModel.refreshSummary() on pull
  - Show success Snackbar

**Layout Template:**

```xml
<androidx.swiperefreshlayout.widget.SwipeRefreshLayout
    android:id="@+id/swipeRefresh"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <ScrollView>
        <LinearLayout android:orientation="vertical" android:padding="16dp">

            <!-- 4 Stat Cards -->
            <GridLayout
                android:columnCount="2"
                android:rowCount="2"
                android:layout_width="match_parent"
                android:layout_height="wrap_content">

                <!-- Done Card -->
                <com.google.android.material.card.MaterialCardView
                    style="@style/Widget.Material3.CardView.Elevated"
                    android:layout_margin="8dp">

                    <LinearLayout android:padding="16dp" android:orientation="vertical">
                        <ImageView
                            android:src="@drawable/ic_check_circle"
                            android:tint="@color/green_500"
                            android:layout_width="24dp"
                            android:layout_height="24dp" />

                        <TextView
                            android:id="@+id/tvDoneCount"
                            android:text="0"
                            android:textSize="32sp"
                            android:textStyle="bold"
                            android:layout_marginTop="8dp" />

                        <TextView
                            android:text="done"
                            android:textSize="14sp" />

                        <TextView
                            android:text="in the last 7 days"
                            android:textSize="10sp"
                            android:textColor="@color/text_secondary" />
                    </LinearLayout>
                </com.google.android.material.card.MaterialCardView>

                <!-- Updated Card (similar) -->
                <!-- Created Card (similar) -->
                <!-- Due Card (similar) -->
            </GridLayout>

            <!-- Status Overview Card -->
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

                    <!-- Donut Chart -->
                    <com.github.mikephil.charting.charts.PieChart
                        android:id="@+id/chartStatus"
                        android:layout_width="200dp"
                        android:layout_height="200dp"
                        android:layout_gravity="center"
                        android:layout_marginTop="16dp" />

                    <!-- Legend -->
                    <LinearLayout android:orientation="horizontal" android:layout_marginTop="16dp">
                        <!-- TO_DO legend -->
                        <LinearLayout android:layout_weight="1">
                            <View
                                android:background="@color/status_todo"
                                android:layout_width="16dp"
                                android:layout_height="16dp" />
                            <TextView
                                android:id="@+id/tvToDoCount"
                                android:text="To Do: 0" />
                        </LinearLayout>
                        <!-- IN_PROGRESS, IN_REVIEW, DONE legends -->
                    </LinearLayout>
                </LinearLayout>
            </com.google.android.material.card.MaterialCardView>

        </LinearLayout>
    </ScrollView>
</androidx.swiperefreshlayout.widget.SwipeRefreshLayout>
```

**Chart Implementation:**

```java
private void setupDonutChart(ProjectSummaryResponse.StatusOverview overview) {
    PieChart chart = view.findViewById(R.id.chartStatus);

    List<PieEntry> entries = new ArrayList<>();
    entries.add(new PieEntry(overview.getToDo(), "To Do"));
    entries.add(new PieEntry(overview.getInProgress(), "In Progress"));
    entries.add(new PieEntry(overview.getInReview(), "In Review"));
    entries.add(new PieEntry(overview.getDone(), "Done"));

    PieDataSet dataSet = new PieDataSet(entries, "");
    dataSet.setColors(
        Color.parseColor("#9E9E9E"),  // To Do - Gray
        Color.parseColor("#2196F3"),  // In Progress - Blue
        Color.parseColor("#FF9800"),  // In Review - Orange
        Color.parseColor("#4CAF50")   // Done - Green
    );
    dataSet.setValueTextSize(12f);
    dataSet.setValueTextColor(Color.WHITE);

    PieData data = new PieData(dataSet);
    chart.setData(data);
    chart.setDrawHoleEnabled(true);  // Donut style
    chart.setHoleRadius(60f);
    chart.setTransparentCircleRadius(65f);
    chart.getDescription().setEnabled(false);
    chart.getLegend().setEnabled(false);  // Use custom legend
    chart.animateY(1000);
    chart.invalidate();
}
```

---

## 🔧 Integration Tasks (Day 5)

### Nov 14 - 4 hours

- [ ] **Test E2E flows:**
  - Meeting Scheduler: Select members → Find times → Create meeting
  - Quick Event: Open dialog → Fill form → Create event
  - Summary: View stats → Pull to refresh → See updates

- [ ] **Fix bugs** found during testing

- [ ] **Add animations:**
  - Card enter animations
  - Transition animations
  - Loading shimmer effect

- [ ] **Accessibility:**
  - contentDescription for ImageViews
  - Proper focus order
  - Screen reader support

---

## 🎯 Daily Targets

| Day   | Date   | Hours | Deliverables                     | Must Complete |
| ----- | ------ | ----- | -------------------------------- | ------------- |
| Day 1 | Nov 10 | 6h    | Meeting layouts + Member adapter | ✅ YES        |
| Day 2 | Nov 11 | 6h    | Time slot adapter + Confirmation | ✅ YES        |
| Day 3 | Nov 12 | 6h    | Quick Event dialog + FAB         | ✅ YES        |
| Day 4 | Nov 13 | 5h    | Summary widgets + Chart          | ✅ YES        |
| Day 5 | Nov 14 | 4h    | Testing + Polish                 | ⚠️ HIGH       |
| Day 6 | Nov 15 | 2h    | Bug fixes + Demo prep            | ✅ YES        |

**Total:** 29 hours (slightly over 23 needed - good buffer)

---

## 📚 Resources You Need

### Documentation

- [Work Division Doc](./FRONTEND_WORK_DIVISION.md) - Your original assignments
- [ViewModel Reference](../integration/DEVELOPER_GUIDE_BACKEND.md) - API contracts
- [Audit Report](./FRONTEND_DEV_AUDIT_REPORT.md) - What's missing

### Libraries

```gradle
// Already in build.gradle
implementation 'com.google.android.material:material:1.9.0'
implementation 'androidx.recyclerview:recyclerview:1.3.0'
implementation 'com.github.PhilJay:MPAndroidChart:v3.1.0'
```

### Code Examples

- Dev1's ViewModels → See how to observe LiveData
- Existing Fragment → ProjectSummaryFragment.java (now fixed)
- TimeSlot.java → See formatting helper methods

---

## 🚨 Common Pitfalls to Avoid

### 1. API Mismatch (Already happened once!)

**Wrong:**

```java
viewModel.getStatistics().observe(...)  // Method doesn't exist!
```

**Correct:**

```java
// Check ViewModel first!
// MeetingSchedulerViewModel has:
viewModel.getSuggestedTimes().observe(...)     // ✅
viewModel.getIsLoading().observe(...)          // ✅
viewModel.getMeetingCreated().observe(...)     // ✅
```

### 2. Not Using DiffUtil

**Wrong:**

```java
public class MyAdapter extends RecyclerView.Adapter {
    public void setData(List<Item> items) {
        this.items = items;
        notifyDataSetChanged();  // ❌ Inefficient!
    }
}
```

**Correct:**

```java
public class MyAdapter extends ListAdapter<Item, ViewHolder> {
    public MyAdapter() {
        super(DIFF_CALLBACK);  // ✅ Efficient updates
    }

    static final DiffUtil.ItemCallback<Item> DIFF_CALLBACK = ...
}
```

### 3. Forgetting to Import DTO Classes

```java
import com.example.tralalero.data.dto.project.ProjectSummaryResponse;  // ✅ Add this!
```

### 4. Not Handling Null Data

```java
viewModel.getSummary().observe(this, summary -> {
    if (summary != null && summary.getStatusOverview() != null) {  // ✅ Null checks
        updateChart(summary.getStatusOverview());
    }
});
```

---

## 🆘 When You're Stuck

### Contact Dev1:

- "What's the exact method name in MeetingSchedulerViewModel?"
- "What data structure does getSuggestedTimes() return?"
- "Can you pair with me for 30 min on the adapter?"

### Check These First:

1. Does ViewModel method exist? → Read ViewModel.java file
2. Are you observing the right LiveData? → Check method names
3. Is import statement correct? → Check package names
4. Did you call ViewModel method? → loadSummary(), suggestTimes(), etc.

---

## ✅ Success Criteria

### Meeting Scheduler

- [ ] User can select 2+ members from bottom sheet
- [ ] User can set duration (30/60/90 min)
- [ ] User can select date range (next 7 days)
- [ ] Click "Find Times" → Shows 3-5 time slots
- [ ] Time slots color-coded by score
- [ ] Click time slot → Shows confirmation dialog
- [ ] Enter title + description → Create meeting
- [ ] Success message shown

### Quick Event

- [ ] FAB visible in Calendar tab
- [ ] Click FAB → Opens Quick Event dialog
- [ ] Can select date, time, duration
- [ ] Can choose event type (chips)
- [ ] Can toggle Google Meet
- [ ] Click Create → Event created
- [ ] Dialog dismisses on success

### Project Summary

- [ ] 4 stat cards show correct numbers
- [ ] Donut chart displays status breakdown
- [ ] Pull-to-refresh works
- [ ] Loading indicator shows during fetch
- [ ] Error message shown on failure

---

## 📞 Daily Check-ins

**Every day at 9 AM:**

- What did you complete yesterday?
- What are you working on today?
- Any blockers?

**Every day at 5 PM:**

- Push your code to branch
- Update this checklist
- Report progress to team

---

## 🎯 Your Mission

**Transform from 12% → 100% in 6 days**

You can do this! The logic is already done by Dev1. You just need to:

1. Create the layouts (XML)
2. Create the adapters (RecyclerView)
3. Wire them to existing ViewModels
4. Test and polish

**Focus on quality over speed.** Better to complete Meeting Scheduler perfectly than rush all 3 features.

---

**Good luck! 🚀**

**Questions?** Ask Dev1 or Team Lead immediately - don't waste time being stuck!
