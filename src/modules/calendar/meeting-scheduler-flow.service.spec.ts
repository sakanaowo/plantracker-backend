// TODO: Remove this test file after Frontend integration is complete
// This file was created for demonstrating the complete flow logic during development
// Location: src/modules/calendar/meeting-scheduler-flow.service.spec.ts

describe('Meeting Suggestion Flow - Logic Test', () => {
  // Real test data from database
  const REAL_USERS = {
    USER_1: 'GPIpdb60SEX4bAxrz6UvtW9Kcty1', // Minh Doan Quang - Active token
    USER_2: 'D2WdxaQp4hdKv1cZ7lJs0p4IPKW2', // Đoàn Quang Minh - Expired token
    USER_3: 'AqhUZmslU1bKzfs4lgfZdLmwCeK2', // だいさんかお - Expired token
  };

  describe('Complete Flow: Frontend Input → Backend Output', () => {
    it('should validate frontend input format', () => {
      // ===== FRONTEND INPUT =====
      const frontendInput = {
        participantIds: [
          REAL_USERS.USER_1,
          REAL_USERS.USER_2,
          REAL_USERS.USER_3,
        ],
        startDate: '2025-12-09T00:00:00Z', // Từ ngày 9/12
        endDate: '2025-12-10T23:59:59Z', // Đến ngày 10/12 (2 ngày)
        durationMinutes: 60, // Họp 1 tiếng
        maxSuggestions: 5,
      };

      // Verify required fields
      expect(frontendInput.participantIds).toBeDefined();
      expect(Array.isArray(frontendInput.participantIds)).toBe(true);
      expect(frontendInput.participantIds.length).toBeGreaterThan(0);

      expect(frontendInput.startDate).toBeDefined();
      expect(frontendInput.endDate).toBeDefined();
      expect(new Date(frontendInput.startDate).getTime()).toBeLessThan(
        new Date(frontendInput.endDate).getTime(),
      );

      expect(frontendInput.durationMinutes).toBeGreaterThanOrEqual(15);
      expect(frontendInput.durationMinutes).toBeLessThanOrEqual(480);

      expect(frontendInput.maxSuggestions).toBeGreaterThanOrEqual(1);
      expect(frontendInput.maxSuggestions).toBeLessThanOrEqual(10);
    });

    it('should understand 30-minute interval concept', () => {
      // 2 hours (09:00-11:00) with 30-minute intervals
      const start = new Date('2025-12-09T09:00:00Z');
      const end = new Date('2025-12-09T11:00:00Z');
      const intervalMinutes = 30;

      const intervals = [];
      let current = new Date(start);

      while (current < end) {
        intervals.push(new Date(current));
        current = new Date(current.getTime() + intervalMinutes * 60 * 1000);
      }

      // Should generate: 09:00, 09:30, 10:00, 10:30
      expect(intervals.length).toBe(4);
      expect(intervals[0].toISOString()).toBe('2025-12-09T09:00:00.000Z');
      expect(intervals[1].toISOString()).toBe('2025-12-09T09:30:00.000Z');
      expect(intervals[2].toISOString()).toBe('2025-12-09T10:00:00.000Z');
      expect(intervals[3].toISOString()).toBe('2025-12-09T10:30:00.000Z');

      console.log('\n===== 30-MINUTE INTERVALS =====');
      console.log(`Period: ${start.toISOString()} → ${end.toISOString()}`);
      console.log('Generated intervals:');
      intervals.forEach((interval, i) => {
        console.log(`  ${i + 1}. ${interval.toISOString().substring(11, 16)}`);
      });
    });

    it('should calculate score based on available users percentage', () => {
      const totalUsers = 3;

      // Scenario 1: All 3 users available
      const scenario1 = {
        availableUsers: [
          REAL_USERS.USER_1,
          REAL_USERS.USER_2,
          REAL_USERS.USER_3,
        ],
        score: Math.round((3 / totalUsers) * 100),
        label: 'Excellent',
      };

      // Scenario 2: 2 users available
      const scenario2 = {
        availableUsers: [REAL_USERS.USER_1, REAL_USERS.USER_2],
        score: Math.round((2 / totalUsers) * 100),
        label: 'Good',
      };

      // Scenario 3: 1 user available
      const scenario3 = {
        availableUsers: [REAL_USERS.USER_1],
        score: Math.round((1 / totalUsers) * 100),
        label: 'Poor',
      };

      expect(scenario1.score).toBe(100);
      expect(scenario2.score).toBe(67);
      expect(scenario3.score).toBe(33);

      console.log('\n===== SCORE CALCULATION =====');
      console.log(`Total participants: ${totalUsers}`);
      console.log(
        `\nScenario 1: ${scenario1.availableUsers.length}/${totalUsers} available`,
      );
      console.log(`  Score: ${scenario1.score}% → ${scenario1.label}`);
      console.log(
        `\nScenario 2: ${scenario2.availableUsers.length}/${totalUsers} available`,
      );
      console.log(`  Score: ${scenario2.score}% → ${scenario2.label}`);
      console.log(
        `\nScenario 3: ${scenario3.availableUsers.length}/${totalUsers} available`,
      );
      console.log(`  Score: ${scenario3.score}% → ${scenario3.label}`);
    });

    it('should only suggest slots within working hours (9-18)', () => {
      const workingHours = { start: 9, end: 18 };

      // Test valid slots
      const validSlots = [
        { start: '2025-12-09T09:00:00Z', end: '2025-12-09T10:00:00Z' }, // 9-10 AM ✅
        { start: '2025-12-09T14:00:00Z', end: '2025-12-09T15:00:00Z' }, // 2-3 PM ✅
        { start: '2025-12-09T17:00:00Z', end: '2025-12-09T18:00:00Z' }, // 5-6 PM ✅
      ];

      // Test invalid slots (should NOT suggest)
      const invalidSlots = [
        { start: '2025-12-09T08:00:00Z', end: '2025-12-09T09:00:00Z' }, // 8-9 AM ❌ (before 9)
        { start: '2025-12-09T18:00:00Z', end: '2025-12-09T19:00:00Z' }, // 6-7 PM ❌ (after 18)
        { start: '2025-12-09T22:00:00Z', end: '2025-12-09T23:00:00Z' }, // 10-11 PM ❌
      ];

      // Verify valid slots
      validSlots.forEach((slot) => {
        const startHour = new Date(slot.start).getUTCHours();
        const endHour = new Date(slot.end).getUTCHours();
        expect(startHour).toBeGreaterThanOrEqual(workingHours.start);
        expect(endHour).toBeLessThanOrEqual(workingHours.end);
      });

      // Verify invalid slots would be rejected
      invalidSlots.forEach((slot) => {
        const startHour = new Date(slot.start).getUTCHours();
        const endHour = new Date(slot.end).getUTCHours();
        const isValid =
          startHour >= workingHours.start && endHour <= workingHours.end;
        expect(isValid).toBe(false);
      });

      console.log('\n===== WORKING HOURS FILTER =====');
      console.log(
        `Working hours: ${workingHours.start}:00 - ${workingHours.end}:00`,
      );
      console.log('\n✅ Valid slots:');
      validSlots.forEach((s) => {
        console.log(
          `  ${new Date(s.start).toISOString().substring(11, 16)} → ${new Date(s.end).toISOString().substring(11, 16)}`,
        );
      });
      console.log('\n❌ Invalid slots (filtered out):');
      invalidSlots.forEach((s) => {
        console.log(
          `  ${new Date(s.start).toISOString().substring(11, 16)} → ${new Date(s.end).toISOString().substring(11, 16)}`,
        );
      });
    });

    it('should demonstrate complete flow with full logic', () => {
      // ===== STEP 1: Frontend Input =====
      const frontendInput = {
        participantIds: ['user-1', 'user-2', 'user-3'],
        startDate: '2025-12-09', // Monday
        endDate: '2025-12-10', // Tuesday
        durationMinutes: 60,
        maxSuggestions: 5,
      };

      console.log('\n========== MEETING SUGGESTION FLOW ==========');
      console.log('\n📝 STEP 1: Frontend sends request');
      console.log(`  POST /events/projects/:projectId/suggest-times`);
      console.log(`  Body:`, JSON.stringify(frontendInput, null, 2));

      // ===== STEP 2: Backend generates 30-minute intervals =====
      const generateIntervals = (start: string, end: string): string[] => {
        const intervals: string[] = [];
        const startDate = new Date(`${start}T09:00:00`); // Working hours start
        const endDate = new Date(`${end}T18:00:00`); // Working hours end

        let current = new Date(startDate);
        while (current < endDate) {
          const hour = String(current.getHours()).padStart(2, '0');
          const min = String(current.getMinutes()).padStart(2, '0');
          intervals.push(`${hour}:${min}`);
          current.setMinutes(current.getMinutes() + 30);
        }
        return intervals;
      };

      const intervals = generateIntervals(
        frontendInput.startDate,
        frontendInput.endDate,
      );

      console.log('\n🔄 STEP 2: Backend generates 30-minute intervals');
      console.log(`  Total intervals: ${intervals.length}`);
      console.log(`  Sample: ${intervals.slice(0, 6).join(', ')}...`);

      // ===== STEP 3: Simulate Google Calendar FreeBusy data =====
      const busyPeriods = {
        'user-1': [{ start: '09:00', end: '10:00' }], // Busy 9-10am
        'user-2': [{ start: '14:00', end: '15:00' }], // Busy 2-3pm
        'user-3': [], // Free all day
      };

      console.log('\n📅 STEP 3: Query Google Calendar FreeBusy');
      Object.entries(busyPeriods).forEach(([user, busy]) => {
        if (busy.length === 0) {
          console.log(`  ${user}: Free all day`);
        } else {
          console.log(
            `  ${user}: Busy ${busy.map((b) => `${b.start}-${b.end}`).join(', ')}`,
          );
        }
      });

      // ===== STEP 4: Check availability for each interval =====
      const checkAvailability = (time: string, duration: number) => {
        const [hour, min] = time.split(':').map(Number);
        const startMinutes = hour * 60 + min;
        const endMinutes = startMinutes + duration;

        const available: string[] = [];
        const unavailable: string[] = [];

        Object.entries(busyPeriods).forEach(([userId, busy]) => {
          let isAvailable = true;

          for (const period of busy) {
            const [bh, bm] = period.start.split(':').map(Number);
            const [eh, em] = period.end.split(':').map(Number);
            const busyStart = bh * 60 + bm;
            const busyEnd = eh * 60 + em;

            // Check if intervals overlap
            if (startMinutes < busyEnd && endMinutes > busyStart) {
              isAvailable = false;
              break;
            }
          }

          if (isAvailable) {
            available.push(userId);
          } else {
            unavailable.push(userId);
          }
        });

        return { available, unavailable };
      };

      // ===== STEP 5: Calculate scores and generate suggestions =====
      const suggestions = intervals
        .filter((time) => {
          // Only check slots that can fit the meeting duration
          const [hour] = time.split(':').map(Number);
          return hour >= 9 && hour < 18 - frontendInput.durationMinutes / 60;
        })
        .map((time) => {
          const { available, unavailable } = checkAvailability(
            time,
            frontendInput.durationMinutes,
          );
          const score = Math.round(
            (available.length / frontendInput.participantIds.length) * 100,
          );

          let scoreLabel = 'Poor';
          if (score >= 90) scoreLabel = 'Excellent';
          else if (score >= 70) scoreLabel = 'Good';
          else if (score >= 50) scoreLabel = 'Fair';

          const [hour, min] = time.split(':').map(Number);
          const endHour = Math.floor(
            (hour * 60 + min + frontendInput.durationMinutes) / 60,
          );
          const endMin = (hour * 60 + min + frontendInput.durationMinutes) % 60;

          return {
            start: `${frontendInput.startDate}T${time}:00`,
            end: `${frontendInput.startDate}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`,
            availableUsers: available,
            unavailableUsers: unavailable,
            score,
            scoreLabel,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, frontendInput.maxSuggestions);

      console.log('\n⚙️ STEP 4-5: Calculate availability and scores');
      console.log(
        `  Checking ${intervals.length} intervals for ${frontendInput.durationMinutes}-minute slots`,
      );
      console.log(`  Filtering by working hours (9am-6pm)`);
      console.log(`  Score formula: (available / total) × 100`);

      // ===== STEP 6: Return sorted suggestions =====
      console.log('\n📤 STEP 6: Backend response (sorted by score)');
      suggestions.forEach((suggestion, index) => {
        const icon = index === 0 ? '⭐' : '  ';
        console.log(
          `${icon} ${index + 1}. ${suggestion.start.split('T')[1]} → ${suggestion.end.split('T')[1]}`,
        );
        console.log(
          `     Score: ${suggestion.score}% (${suggestion.scoreLabel})`,
        );
        console.log(`     Available: ${suggestion.availableUsers.join(', ')}`);
        if (suggestion.unavailableUsers.length > 0) {
          console.log(`     Busy: ${suggestion.unavailableUsers.join(', ')}`);
        }
      });

      // ===== ASSERTIONS =====
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(
        frontendInput.maxSuggestions,
      );

      // Best suggestion should have highest score
      expect(suggestions[0].score).toBeGreaterThanOrEqual(
        suggestions[suggestions.length - 1].score,
      );

      // Best slot should be when all users are available
      const bestSlot = suggestions[0];
      expect(bestSlot.availableUsers.length).toBe(
        frontendInput.participantIds.length,
      );
      expect(bestSlot.score).toBe(100);
      expect(bestSlot.scoreLabel).toBe('Excellent');

      console.log(
        '\n✅ Flow validated: Frontend → Generate intervals → Check FreeBusy → Score → Sort → Return',
      );
      console.log('==========================================\n');
    });
  });
});
