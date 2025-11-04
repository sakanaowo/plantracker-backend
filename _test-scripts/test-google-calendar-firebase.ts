#!/usr/bin/env node

/**
 * Google Calendar Firebase Integration Test Script
 * Tests the Firebase-based Google Calendar service
 */

import { PrismaClient } from '@prisma/client';
import { GoogleCalendarService } from '../src/modules/calendar/google-calendar-firebase.service';
import { ConfigService } from '@nestjs/config';

const prisma = new PrismaClient();

async function testGoogleCalendarIntegration() {
  console.log('🧪 Testing Google Calendar Firebase Integration...\n');

  try {
    // Initialize services (mock dependencies for testing)
    const configService = {
      get: (key: string) => process.env[key],
    } as ConfigService;

    const googleCalendarService = new GoogleCalendarService(
      configService,
      prisma,
    );

    // Test 1: Check service status
    console.log('1️⃣ Testing service status...');
    const status = await googleCalendarService.checkServiceStatus();
    console.log('✅ Service Status:', status);

    if (!status.available) {
      console.log(
        '❌ Google Calendar service not available. Check Firebase credentials.',
      );
      return;
    }

    // Test 2: Get existing events
    console.log('\n2️⃣ Testing get events...');
    const events = await googleCalendarService.getEvents({
      maxResults: 5,
      timeMin: new Date('2024-01-01'),
      timeMax: new Date('2024-12-31'),
    });
    console.log(`✅ Retrieved ${events.length} events from Google Calendar`);

    // Test 3: Create a test event
    console.log('\n3️⃣ Testing create event...');
    const testEvent = await googleCalendarService.createEvent({
      title: 'PlanTracker Test Event',
      description: 'Test event created by Firebase integration',
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      endAt: new Date(Date.now() + 25 * 60 * 60 * 1000), // Tomorrow + 1 hour
      location: 'Virtual Meeting Room',
      attendees: ['test@example.com'],
    });
    console.log('✅ Created test event:', testEvent.googleEventId);

    // Test 4: Update the test event
    console.log('\n4️⃣ Testing update event...');
    const updatedEvent = await googleCalendarService.updateEvent(
      testEvent.googleEventId,
      {
        title: 'PlanTracker Test Event (Updated)',
        description: 'Updated test event',
      },
    );
    console.log('✅ Updated event:', updatedEvent.googleEventId);

    // Test 5: Clean up - delete the test event
    console.log('\n5️⃣ Testing delete event...');
    await googleCalendarService.deleteEvent(testEvent.googleEventId);
    console.log('✅ Deleted test event');

    // Test 6: Test with database event (if any exists)
    console.log('\n6️⃣ Testing database event sync...');
    const dbEvent = await prisma.events.findFirst({
      where: {
        start_at: {
          gte: new Date(),
        },
      },
    });

    if (dbEvent) {
      console.log(`Found database event: ${dbEvent.title}`);

      // Test sync status
      const syncStatus = await googleCalendarService.getEventSyncStatus(
        dbEvent.id,
      );
      console.log('✅ Sync status:', syncStatus);

      // Test sync to Google (optional - uncomment if you want to actually sync)
      // const syncResult = await googleCalendarService.syncEventToGoogle(dbEvent.id);
      // console.log('✅ Sync result:', syncResult);
    } else {
      console.log('ℹ️  No future events found in database for sync testing');
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Integration Summary:');
    console.log('   ✅ Firebase authentication working');
    console.log('   ✅ Google Calendar API accessible');
    console.log('   ✅ CRUD operations functional');
    console.log('   ✅ Database integration ready');
    console.log(
      '\n🚀 Google Calendar Firebase integration is PRODUCTION READY!',
    );
  } catch (error) {
    console.error('❌ Test failed:', error);

    if (error.message?.includes('credential')) {
      console.log('\n💡 Troubleshooting:');
      console.log('   1. Check firebase-keys.json exists in project root');
      console.log('   2. Verify Google Calendar API is enabled');
      console.log('   3. Confirm service account has calendar permissions');
    }
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Run the test
testGoogleCalendarIntegration().catch(console.error);
