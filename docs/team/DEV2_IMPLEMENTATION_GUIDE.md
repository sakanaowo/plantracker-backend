# 📱 Dev2 Implementation Guide - Quick Start

**Updated:** November 9, 2025  
**Target:** Complete UI implementation in 6 days  
**Current Progress:** Layout exists for Project Summary ✅, Missing: Meeting Scheduler & Quick Event ❌

---

## 🎯 Tình Hình Hiện Tại

### ✅ Đã Có (Dev1 đã làm xong)

**Backend APIs:** 100% hoàn thành

- ✅ POST `/api/calendar/meetings/suggest-times` - Gợi ý thời gian họp
- ✅ POST `/api/calendar/meetings/create` - Tạo meeting
- ✅ POST `/api/events/projects` - Tạo quick event
- ✅ GET `/api/projects/:id/summary` - Lấy thống kê project

**ViewModels:** 100% hoàn thành

- ✅ `MeetingSchedulerViewModel.java` (216 lines) - Đầy đủ logic
- ✅ `QuickEventViewModel.java` (274 lines) - Đầy đủ logic
- ✅ `ProjectSummaryViewModel.java` (192 lines) - Đầy đủ logic

**Models:** Đầy đủ với helper methods

- ✅ `TimeSlot.java` - Có `getFormattedDate()`, `getFormattedTimeRange()`, `getScoreBadge()`
- ✅ `MeetingTimeSuggestion.java`
- ✅ `CreateMeetingRequest.java`
- ✅ `ProjectSummaryResponse.java` với nested `StatusOverview`
- ✅ `EventType.java`, `RecurrenceType.java` enums

**Repositories:** Hoàn chỉnh

- ✅ `MeetingSchedulerRepositoryImpl.java`
- ✅ `EventRepositoryImpl.java`
- ✅ `ProjectRepositoryImpl.java`

---

### ⚠️ Đã Có Nhưng Chưa Hoàn Chỉnh

**Project Summary:**

- ✅ `fragment_project_summary.xml` - Layout CÓ RỒI (4 cards + status list)
- ✅ `ProjectSummaryFragment.java` - Fragment CÓ RỒI (đã fix lỗi)
- ❌ Thiếu: Pull-to-refresh, animations, chart thực sự (đang dùng placeholder)

---

### ❌ Chưa Có (Cần làm NGAY)

**Meeting Scheduler UI - 0%**

- ❌ Layouts (dialogs, items)
- ❌ Adapters (member selection, time slots)
- ❌ Dialogs/Fragments chính

**Quick Event UI - 0%**

- ❌ Layout dialog quick event
- ❌ Dialog controller
- ❌ FAB integration

---

## 📋 Chi Tiết Từng Phần Cần Làm

### 🔴 PRIORITY 1: Meeting Scheduler (Ngày 1-2)

#### File Cần Tạo

```
app/src/main/res/layout/
├── bottom_sheet_member_selection.xml  ⭐ Mới
├── item_member_selectable.xml         ✅ ĐÃ CÓ (reuse existing)
├── dialog_time_slot_selection.xml     ⭐ Mới
├── item_time_slot.xml                 ⭐ Mới
└── dialog_meeting_confirmation.xml    ⭐ Mới

app/src/main/java/.../feature/home/ui/Home/calendar/
├── MemberSelectionBottomSheet.java    ⭐ Mới
├── TimeSlotSelectionDialog.java       ⭐ Mới
├── TimeSlotAdapter.java               ⭐ Mới
└── MeetingConfirmationDialog.java     ⭐ Mới
```

---

#### 1. Member Selection Bottom Sheet

**File:** `bottom_sheet_member_selection.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="16dp"
    android:background="@drawable/bottom_sheet_background">

    <!-- Handle bar -->
    <View
        android:layout_width="40dp"
        android:layout_height="4dp"
        android:layout_gravity="center_horizontal"
        android:background="#CCCCCC"
        android:layout_marginBottom="16dp"/>

    <!-- Title -->
    <TextView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Select Team Members"
        android:textSize="20sp"
        android:textStyle="bold"
        android:textColor="#333333"
        android:layout_marginBottom="8dp"/>

    <TextView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Choose members to check their availability"
        android:textSize="14sp"
        android:textColor="#666666"
        android:layout_marginBottom="16dp"/>

    <!-- Search box (optional but recommended) -->
    <com.google.android.material.textfield.TextInputLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Search members"
        style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox"
        android:layout_marginBottom="16dp">

        <com.google.android.material.textfield.TextInputEditText
            android:id="@+id/etSearch"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:inputType="text"
            android:drawableStart="@drawable/ic_search"
            android:drawablePadding="8dp"/>
    </com.google.android.material.textfield.TextInputLayout>

    <!-- Selected count -->
    <TextView
        android:id="@+id/tvSelectedCount"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="0 members selected"
        android:textSize="14sp"
        android:textColor="#666666"
        android:layout_marginBottom="8dp"/>

    <!-- Member list -->
    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/rvMembers"
        android:layout_width="match_parent"
        android:layout_height="300dp"
        app:layoutManager="androidx.recyclerview.widget.LinearLayoutManager"/>

    <!-- Action buttons -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:layout_marginTop="16dp">

        <Button
            android:id="@+id/btnCancel"
            style="@style/Widget.MaterialComponents.Button.OutlinedButton"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Cancel"
            android:layout_marginEnd="8dp"/>

        <Button
            android:id="@+id/btnNext"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Next"
            android:layout_marginStart="8dp"
            android:enabled="false"/>
    </LinearLayout>
</LinearLayout>
```

**File:** `MemberSelectionBottomSheet.java`

```java
package com.example.tralalero.feature.home.ui.Home.calendar;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.tralalero.R;
import com.example.tralalero.domain.model.User;
import com.google.android.material.bottomsheet.BottomSheetDialogFragment;
import com.google.android.material.textfield.TextInputEditText;

import java.util.ArrayList;
import java.util.List;

public class MemberSelectionBottomSheet extends BottomSheetDialogFragment {

    private List<User> allMembers;
    private List<User> selectedMembers = new ArrayList<>();
    private MemberSelectionListener listener;
    private MemberSelectionAdapter adapter;

    private RecyclerView rvMembers;
    private TextView tvSelectedCount;
    private Button btnNext;
    private TextInputEditText etSearch;

    public interface MemberSelectionListener {
        void onMembersSelected(List<User> members);
    }

    public static MemberSelectionBottomSheet newInstance(List<User> members) {
        MemberSelectionBottomSheet fragment = new MemberSelectionBottomSheet();
        Bundle args = new Bundle();
        // Pass members via parcelable if User implements Parcelable
        // Or use ViewModel to share data
        fragment.setArguments(args);
        return fragment;
    }

    public void setMembers(List<User> members) {
        this.allMembers = members;
    }

    public void setListener(MemberSelectionListener listener) {
        this.listener = listener;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.bottom_sheet_member_selection, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        initializeViews(view);
        setupRecyclerView();
        setupSearchFilter();
        setupButtons();
    }

    private void initializeViews(View view) {
        rvMembers = view.findViewById(R.id.rvMembers);
        tvSelectedCount = view.findViewById(R.id.tvSelectedCount);
        btnNext = view.findViewById(R.id.btnNext);
        etSearch = view.findViewById(R.id.etSearch);
        view.findViewById(R.id.btnCancel).setOnClickListener(v -> dismiss());
    }

    private void setupRecyclerView() {
        adapter = new MemberSelectionAdapter(
            allMembers != null ? allMembers : new ArrayList<>(),
            this::onMemberToggled
        );

        rvMembers.setLayoutManager(new LinearLayoutManager(getContext()));
        rvMembers.setAdapter(adapter);
    }

    private void setupSearchFilter() {
        if (etSearch != null) {
            etSearch.addTextChangedListener(new TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {
                    adapter.filter(s.toString());
                }

                @Override
                public void afterTextChanged(Editable s) {}
            });
        }
    }

    private void setupButtons() {
        btnNext.setOnClickListener(v -> {
            if (listener != null) {
                listener.onMembersSelected(selectedMembers);
            }
            dismiss();
        });
    }

    private void onMemberToggled(User user, boolean isSelected) {
        if (isSelected) {
            if (!selectedMembers.contains(user)) {
                selectedMembers.add(user);
            }
        } else {
            selectedMembers.remove(user);
        }

        updateSelectedCount();
        btnNext.setEnabled(!selectedMembers.isEmpty());
    }

    private void updateSelectedCount() {
        int count = selectedMembers.size();
        tvSelectedCount.setText(count + " member" + (count != 1 ? "s" : "") + " selected");
    }
}
```

**QUAN TRỌNG:** File `item_member_selectable.xml` ĐÃ TỒN TẠI rồi, bạn có thể reuse. Chỉ cần tạo adapter:

**File:** `MemberSelectionAdapter.java`

```java
package com.example.tralalero.feature.home.ui.Home.calendar;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.example.tralalero.R;
import com.example.tralalero.domain.model.User;

import java.util.ArrayList;
import java.util.List;

public class MemberSelectionAdapter extends RecyclerView.Adapter<MemberSelectionAdapter.ViewHolder> {

    private List<User> allMembers;
    private List<User> filteredMembers;
    private List<String> selectedIds = new ArrayList<>();
    private OnMemberToggleListener listener;

    public interface OnMemberToggleListener {
        void onToggle(User user, boolean isSelected);
    }

    public MemberSelectionAdapter(List<User> members, OnMemberToggleListener listener) {
        this.allMembers = members;
        this.filteredMembers = new ArrayList<>(members);
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
            .inflate(R.layout.item_member_selectable, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        User member = filteredMembers.get(position);
        holder.bind(member, selectedIds.contains(member.getId()));
    }

    @Override
    public int getItemCount() {
        return filteredMembers.size();
    }

    public void filter(String query) {
        filteredMembers.clear();

        if (query == null || query.trim().isEmpty()) {
            filteredMembers.addAll(allMembers);
        } else {
            String lowerQuery = query.toLowerCase();
            for (User member : allMembers) {
                if (member.getName().toLowerCase().contains(lowerQuery) ||
                    member.getEmail().toLowerCase().contains(lowerQuery)) {
                    filteredMembers.add(member);
                }
            }
        }

        notifyDataSetChanged();
    }

    class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivAvatar;
        TextView tvName;
        TextView tvEmail;
        CheckBox checkbox;

        ViewHolder(View itemView) {
            super(itemView);
            ivAvatar = itemView.findViewById(R.id.ivMemberAvatar);
            tvName = itemView.findViewById(R.id.tvMemberName);
            tvEmail = itemView.findViewById(R.id.tvMemberEmail);
            checkbox = itemView.findViewById(R.id.checkboxMember);
        }

        void bind(User member, boolean isSelected) {
            tvName.setText(member.getName());
            tvEmail.setText(member.getEmail());
            checkbox.setChecked(isSelected);

            // Load avatar
            if (member.getAvatar() != null && !member.getAvatar().isEmpty()) {
                Glide.with(itemView.getContext())
                    .load(member.getAvatar())
                    .placeholder(R.drawable.ic_person)
                    .circleCrop()
                    .into(ivAvatar);
            } else {
                ivAvatar.setImageResource(R.drawable.ic_person);
            }

            // Handle click
            itemView.setOnClickListener(v -> {
                boolean newState = !checkbox.isChecked();
                checkbox.setChecked(newState);

                if (newState) {
                    selectedIds.add(member.getId());
                } else {
                    selectedIds.remove(member.getId());
                }

                if (listener != null) {
                    listener.onToggle(member, newState);
                }
            });

            checkbox.setOnCheckedChangeListener((buttonView, checked) -> {
                if (checked && !selectedIds.contains(member.getId())) {
                    selectedIds.add(member.getId());
                } else if (!checked) {
                    selectedIds.remove(member.getId());
                }

                if (listener != null) {
                    listener.onToggle(member, checked);
                }
            });
        }
    }
}
```

---

#### 2. Time Slot Selection Dialog

**File:** `dialog_time_slot_selection.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:padding="24dp"
    android:background="@android:color/white">

    <!-- Title -->
    <TextView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Find Meeting Time"
        android:textSize="24sp"
        android:textStyle="bold"
        android:textColor="#333333"
        android:layout_marginBottom="24dp"/>

    <!-- Duration Input -->
    <com.google.android.material.textfield.TextInputLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Duration (minutes)"
        style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox"
        android:layout_marginBottom="16dp">

        <com.google.android.material.textfield.TextInputEditText
            android:id="@+id/etDuration"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:inputType="number"
            android:text="60"/>
    </com.google.android.material.textfield.TextInputLayout>

    <!-- Date Range -->
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Date Range"
        android:textSize="14sp"
        android:textColor="#666666"
        android:layout_marginBottom="8dp"/>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:layout_marginBottom="16dp">

        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:hint="Start Date"
            style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox"
            android:layout_marginEnd="8dp">

            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etStartDate"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:focusable="false"
                android:clickable="true"
                android:drawableEnd="@drawable/ic_calendar"
                android:inputType="none"/>
        </com.google.android.material.textfield.TextInputLayout>

        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:hint="End Date"
            style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox"
            android:layout_marginStart="8dp">

            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etEndDate"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:focusable="false"
                android:clickable="true"
                android:drawableEnd="@drawable/ic_calendar"
                android:inputType="none"/>
        </com.google.android.material.textfield.TextInputLayout>
    </LinearLayout>

    <!-- Find Times Button -->
    <Button
        android:id="@+id/btnFindTimes"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Find Available Times"
        android:textAllCaps="false"
        android:paddingVertical="12dp"
        android:layout_marginBottom="24dp"/>

    <!-- Loading Indicator -->
    <ProgressBar
        android:id="@+id/progressBar"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="center"
        android:visibility="gone"
        android:layout_marginBottom="16dp"/>

    <!-- Results Title -->
    <TextView
        android:id="@+id/tvResultsTitle"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Suggested Times"
        android:textSize="18sp"
        android:textStyle="bold"
        android:textColor="#333333"
        android:visibility="gone"
        android:layout_marginBottom="16dp"/>

    <!-- Time Slots List -->
    <androidx.recyclerview.widget.RecyclerView
        android:id="@+id/rvTimeSlots"
        android:layout_width="match_parent"
        android:layout_height="300dp"
        android:visibility="gone"
        app:layoutManager="androidx.recyclerview.widget.LinearLayoutManager"/>

    <!-- Empty State -->
    <LinearLayout
        android:id="@+id/layoutEmptyState"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:gravity="center"
        android:padding="32dp"
        android:visibility="gone">

        <ImageView
            android:layout_width="80dp"
            android:layout_height="80dp"
            android:src="@drawable/ic_calendar"
            app:tint="#CCCCCC"
            android:layout_marginBottom="16dp"/>

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="No available times found"
            android:textSize="16sp"
            android:textColor="#666666"
            android:textAlignment="center"/>
    </LinearLayout>

    <!-- Close Button -->
    <Button
        android:id="@+id/btnClose"
        style="@style/Widget.MaterialComponents.Button.OutlinedButton"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Close"
        android:layout_marginTop="16dp"/>
</LinearLayout>
```

**File:** `item_time_slot.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<com.google.android.material.card.MaterialCardView
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginVertical="4dp"
    app:cardCornerRadius="12dp"
    app:cardElevation="2dp"
    app:strokeWidth="1dp"
    app:strokeColor="#E0E0E0"
    android:foreground="?attr/selectableItemBackground">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:padding="16dp"
        android:gravity="center_vertical">

        <!-- Time Info -->
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical">

            <TextView
                android:id="@+id/tvDate"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Monday, Nov 11"
                android:textSize="16sp"
                android:textStyle="bold"
                android:textColor="#333333"/>

            <TextView
                android:id="@+id/tvTimeRange"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="2:00 PM - 3:00 PM"
                android:textSize="14sp"
                android:textColor="#666666"
                android:layout_marginTop="4dp"/>

            <TextView
                android:id="@+id/tvAvailability"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="3 of 4 available"
                android:textSize="12sp"
                android:textColor="#999999"
                android:layout_marginTop="4dp"/>
        </LinearLayout>

        <!-- Score Badge -->
        <com.google.android.material.chip.Chip
            android:id="@+id/chipScore"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="75% available"
            android:textColor="@android:color/white"
            android:textSize="12sp"
            app:chipBackgroundColor="#4CAF50"
            app:chipCornerRadius="16dp"
            android:clickable="false"
            android:focusable="false"/>
    </LinearLayout>
</com.google.android.material.card.MaterialCardView>
```

**File:** `TimeSlotAdapter.java`

```java
package com.example.tralalero.feature.home.ui.Home.calendar;

import android.content.res.ColorStateList;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android:view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.DiffUtil;
import androidx.recyclerview.widget.ListAdapter;
import androidx.recyclerview.widget.RecyclerView;

import com.example.tralalero.R;
import com.example.tralalero.domain.model.TimeSlot;
import com.google.android.material.chip.Chip;

public class TimeSlotAdapter extends ListAdapter<TimeSlot, TimeSlotAdapter.ViewHolder> {

    private OnTimeSlotClickListener listener;

    public interface OnTimeSlotClickListener {
        void onTimeSlotClick(TimeSlot timeSlot);
    }

    public TimeSlotAdapter(OnTimeSlotClickListener listener) {
        super(DIFF_CALLBACK);
        this.listener = listener;
    }

    private static final DiffUtil.ItemCallback<TimeSlot> DIFF_CALLBACK =
        new DiffUtil.ItemCallback<TimeSlot>() {
            @Override
            public boolean areItemsTheSame(@NonNull TimeSlot oldItem, @NonNull TimeSlot newItem) {
                return oldItem.getStart().equals(newItem.getStart());
            }

            @Override
            public boolean areContentsTheSame(@NonNull TimeSlot oldItem, @NonNull TimeSlot newItem) {
                return oldItem.getScore() == newItem.getScore() &&
                       oldItem.getAvailableUsers().size() == newItem.getAvailableUsers().size();
            }
        };

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
            .inflate(R.layout.item_time_slot, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        holder.bind(getItem(position), listener);
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvDate;
        TextView tvTimeRange;
        TextView tvAvailability;
        Chip chipScore;

        ViewHolder(View itemView) {
            super(itemView);
            tvDate = itemView.findViewById(R.id.tvDate);
            tvTimeRange = itemView.findViewById(R.id.tvTimeRange);
            tvAvailability = itemView.findViewById(R.id.tvAvailability);
            chipScore = itemView.findViewById(R.id.chipScore);
        }

        void bind(TimeSlot slot, OnTimeSlotClickListener listener) {
            // Use helper methods from TimeSlot model
            tvDate.setText(slot.getFormattedDate());
            tvTimeRange.setText(slot.getFormattedTimeRange());
            tvAvailability.setText(slot.getAvailableUsers().size() + " available");
            chipScore.setText(slot.getScoreBadge());

            // Color-code based on score
            int color;
            if (slot.getScore() >= 80) {
                color = Color.parseColor("#4CAF50"); // Green - Excellent
            } else if (slot.getScore() >= 60) {
                color = Color.parseColor("#FF9800"); // Orange - Good
            } else {
                color = Color.parseColor("#F44336"); // Red - Fair
            }
            chipScore.setChipBackgroundColor(ColorStateList.valueOf(color));

            // Handle click
            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onTimeSlotClick(slot);
                }
            });
        }
    }
}
```

---

### 🟡 PRIORITY 2: Quick Event (Ngày 3)

**Đơn giản hơn nhiều! Chỉ cần 1 dialog và FAB**

#### File Cần Tạo

```
app/src/main/res/layout/
└── dialog_quick_event.xml             ⭐ Mới

app/src/main/java/.../feature/home/ui/Home/event/
└── QuickEventDialog.java              ⭐ Mới
```

**File:** `dialog_quick_event.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<ScrollView xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:background="@android:color/white">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="vertical"
        android:padding="24dp">

        <!-- Title -->
        <TextView
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="Quick Event"
            android:textSize="24sp"
            android:textStyle="bold"
            android:textColor="#333333"
            android:layout_marginBottom="24dp"/>

        <!-- Event Title -->
        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:hint="Event Title"
            style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox"
            android:layout_marginBottom="16dp">

            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etTitle"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:inputType="text"
                android:maxLines="1"/>
        </com.google.android.material.textfield.TextInputLayout>

        <!-- Date and Time -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:layout_marginBottom="16dp">

            <com.google.android.material.textfield.TextInputLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:hint="Date"
                style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox"
                android:layout_marginEnd="8dp">

                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/etDate"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:focusable="false"
                    android:clickable="true"
                    android:drawableEnd="@drawable/ic_calendar"
                    android:inputType="none"/>
            </com.google.android.material.textfield.TextInputLayout>

            <com.google.android.material.textfield.TextInputLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:hint="Time"
                style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox"
                android:layout_marginStart="8dp">

                <com.google.android.material.textfield.TextInputEditText
                    android:id="@+id/etTime"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:focusable="false"
                    android:clickable="true"
                    android:drawableEnd="@drawable/ic_time"
                    android:inputType="none"/>
            </com.google.android.material.textfield.TextInputLayout>
        </LinearLayout>

        <!-- Duration -->
        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:hint="Duration"
            style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox.ExposedDropdownMenu"
            android:layout_marginBottom="16dp">

            <AutoCompleteTextView
                android:id="@+id/actvDuration"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:inputType="none"
                android:text="60 minutes"/>
        </com.google.android.material.textfield.TextInputLayout>

        <!-- Event Type -->
        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Event Type"
            android:textSize="14sp"
            android:textColor="#666666"
            android:layout_marginBottom="8dp"/>

        <com.google.android.material.chip.ChipGroup
            android:id="@+id/chipGroupType"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            app:singleSelection="true"
            android:layout_marginBottom="16dp">

            <com.google.android.material.chip.Chip
                android:id="@+id/chipMeeting"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Meeting"
                android:checked="true"
                style="@style/Widget.MaterialComponents.Chip.Choice"/>

            <com.google.android.material.chip.Chip
                android:id="@+id/chipMilestone"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Milestone"
                style="@style/Widget.MaterialComponents.Chip.Choice"/>

            <com.google.android.material.chip.Chip
                android:id="@+id/chipOther"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="Other"
                style="@style/Widget.MaterialComponents.Chip.Choice"/>
        </com.google.android.material.chip.ChipGroup>

        <!-- Google Meet Toggle -->
        <com.google.android.material.switchmaterial.SwitchMaterial
            android:id="@+id/switchGoogleMeet"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:text="Add Google Meet link"
            android:checked="true"
            android:layout_marginBottom="16dp"/>

        <!-- Description (optional) -->
        <com.google.android.material.textfield.TextInputLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:hint="Description (optional)"
            style="@style/Widget.MaterialComponents.TextInputLayout.OutlinedBox"
            android:layout_marginBottom="24dp">

            <com.google.android.material.textfield.TextInputEditText
                android:id="@+id/etDescription"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:inputType="textMultiLine"
                android:lines="3"
                android:gravity="top"/>
        </com.google.android.material.textfield.TextInputLayout>

        <!-- Action Buttons -->
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal">

            <Button
                android:id="@+id/btnCancel"
                style="@style/Widget.MaterialComponents.Button.OutlinedButton"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="Cancel"
                android:layout_marginEnd="8dp"/>

            <Button
                android:id="@+id/btnCreate"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:text="Create Event"
                android:layout_marginStart="8dp"/>
        </LinearLayout>
    </LinearLayout>
</ScrollView>
```

**Code implementation đơn giản, chỉ cần wire với `QuickEventViewModel` đã có sẵn!**

---

## 🛠️ Công Cụ & Resources Sẵn Có

### ViewModel Methods Bạn Cần Gọi

#### MeetingSchedulerViewModel

```java
// Observe data
viewModel.getSuggestedTimes().observe(this, times -> {
    // Update RecyclerView
});

viewModel.getIsLoading().observe(this, isLoading -> {
    // Show/hide progress
});

viewModel.getMeetingCreated().observe(this, meeting -> {
    // Show success message
});

// Call actions
viewModel.suggestTimes(durationMin, startDate, endDate);
viewModel.createMeeting(timeSlot, title, description);
```

#### QuickEventViewModel

```java
viewModel.getEventCreated().observe(this, event -> {
    // Success
});

viewModel.createEvent(projectId, title, date, time, duration, type, description, createGoogleMeet);
```

#### ProjectSummaryViewModel

```java
viewModel.getSummary().observe(this, summary -> {
    // ĐÃ LÀM RỒI trong Fragment
});

viewModel.loadSummary(projectId);
viewModel.refreshSummary(projectId); // For pull-to-refresh
```

---

## ⚡ Tips Triển Khai Nhanh

### 1. Reuse Existing Layouts

- ✅ `item_member_selectable.xml` ĐÃ CÓ - Dùng luôn cho member selection
- ✅ `fragment_project_summary.xml` ĐÃ CÓ - Chỉ cần thêm pull-to-refresh

### 2. Material Design Components Đã Setup

```gradle
implementation 'com.google.android.material:material:1.9.0' // ĐÃ CÓ
```

Dùng được ngay:

- BottomSheetDialogFragment
- MaterialCardView
- TextInputLayout
- Chip, ChipGroup
- SwitchMaterial

### 3. Glide Đã Setup

```gradle
implementation 'com.github.bumptech.glide:glide:4.16.0' // ĐÃ CÓ
```

Load avatar:

```java
Glide.with(context)
    .load(user.getAvatar())
    .placeholder(R.drawable.ic_person)
    .circleCrop()
    .into(imageView);
```

### 4. Date/Time Pickers

```java
// Date Picker
MaterialDatePicker<Long> datePicker = MaterialDatePicker.Builder.datePicker()
    .setTitleText("Select date")
    .build();

datePicker.addOnPositiveButtonClickListener(selection -> {
    // Handle date
});

datePicker.show(getSupportFragmentManager(), "DATE_PICKER");

// Time Picker
MaterialTimePicker timePicker = new MaterialTimePicker.Builder()
    .setTimeFormat(TimeFormat.CLOCK_12H)
    .setHour(12)
    .setMinute(0)
    .setTitleText("Select time")
    .build();

timePicker.addOnPositiveButtonClickListener(v -> {
    int hour = timePicker.getHour();
    int minute = timePicker.getMinute();
});

timePicker.show(getSupportFragmentManager(), "TIME_PICKER");
```

---

## 🎯 Checklist Từng Ngày

### Ngày 1 (Nov 10) - 6 giờ

- [ ] Tạo `bottom_sheet_member_selection.xml`
- [ ] Tạo `MemberSelectionBottomSheet.java`
- [ ] Tạo `MemberSelectionAdapter.java` (reuse existing item layout)
- [ ] Test: Open bottom sheet, select members, count updates

### Ngày 2 (Nov 11) - 6 giờ

- [ ] Tạo `dialog_time_slot_selection.xml`
- [ ] Tạo `item_time_slot.xml`
- [ ] Tạo `TimeSlotAdapter.java` với DiffUtil
- [ ] Tạo `TimeSlotSelectionDialog.java`
- [ ] Wire với `MeetingSchedulerViewModel`
- [ ] Test: Find times → See suggestions → Click time slot

### Ngày 3 (Nov 12) - 6 giờ

- [ ] Tạo `dialog_quick_event.xml`
- [ ] Tạo `QuickEventDialog.java`
- [ ] Thêm FAB vào Calendar tab layout
- [ ] Wire với `QuickEventViewModel`
- [ ] Test: FAB → Dialog → Create event → Success

### Ngày 4 (Nov 13) - 4 giờ

- [ ] Thêm SwipeRefreshLayout vào `fragment_project_summary.xml`
- [ ] Hook up refresh logic trong Fragment
- [ ] Thêm animations (optional)
- [ ] Polish UI cho cả 3 features

### Ngày 5-6 - Testing & Bug Fixes

- [ ] E2E testing
- [ ] Fix bugs
- [ ] Add error handling UI feedback

---

## 🚨 Lưu Ý Quan Trọng

### 1. Đừng Gọi Sai Method Names!

```java
// ❌ WRONG (lỗi lần trước)
viewModel.getStatistics()
viewModel.getLoading()
viewModel.loadStatistics()

// ✅ CORRECT
viewModel.getSummary()
viewModel.getIsLoading()
viewModel.loadSummary()
```

### 2. Null Checks Luôn Luôn!

```java
viewModel.getSummary().observe(this, summary -> {
    if (summary != null && summary.getStatusOverview() != null) {
        updateUI(summary);
    }
});
```

### 3. Import Đúng Package

```java
import com.example.tralalero.data.dto.project.ProjectSummaryResponse;
import com.example.tralalero.domain.model.TimeSlot;
import com.example.tralalero.domain.model.User;
```

---

## 📞 Cần Giúp Đỡ?

### Khi Stuck:

1. **Đọc ViewModel code** - Xem method names chính xác
2. **Xem TimeSlot.java** - Có helper methods rồi (getFormattedDate(), etc.)
3. **Reuse existing layouts** - Đừng tạo lại từ đầu
4. **Copy code templates** từ document này

### Common Issues:

- **Method not found:** Kiểm tra ViewModel file, xem method name chính xác
- **Null pointer:** Thêm null checks
- **Import error:** Check package name trong model files

---

**Good luck! Bạn làm được! 💪**

Tất cả logic đã có sẵn, chỉ cần tạo UI và wire lại thôi!
