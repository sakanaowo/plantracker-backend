#!/usr/bin/env node

/**
 * Google Calendar Integration Test Script
 * 
 * This script tests the Google Calendar integration endpoints
 * Make sure to set environment variables before running
 */

const axios = require('axios');
const readline = require('readline');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const FIREBASE_TOKEN = process.env.FIREBASE_TOKEN; // Get from Firebase Auth
const PROJECT_ID = process.env.TEST_PROJECT_ID; // Test project UUID

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to make authenticated requests
const apiRequest = async (method, endpoint, data = null) => {
    try {
        const config = {
            method,
            url: `${API_BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${FIREBASE_TOKEN}`
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`❌ Error ${method} ${endpoint}:`, error.response?.data || error.message);
        return null;
    }
};

// Test functions
const testGetAuthUrl = async () => {
    console.log('\n🔐 Testing Google OAuth Auth URL...');
    const result = await apiRequest('GET', '/calendar/google/auth-url');

    if (result && result.authUrl) {
        console.log('✅ Auth URL generated successfully');
        console.log('🌐 Please visit this URL to authorize:');
        console.log(result.authUrl);
        return result.authUrl;
    } else {
        console.log('❌ Failed to get auth URL');
        return null;
    }
};

const testOAuthCallback = async (authCode) => {
    console.log('\n🔄 Testing OAuth callback...');
    const result = await apiRequest('POST', '/calendar/google/callback', {
        code: authCode
    });

    if (result && result.success) {
        console.log('✅ OAuth callback successful');
        console.log('📊 User authenticated and tokens stored');
        return true;
    } else {
        console.log('❌ OAuth callback failed');
        return false;
    }
};

const testIntegrationStatus = async () => {
    console.log('\n📊 Testing integration status...');
    const result = await apiRequest('GET', '/calendar/integration-status');

    if (result) {
        console.log('✅ Integration status retrieved');
        console.log('🔗 Connected:', result.connected);
        console.log('📧 Email:', result.email || 'N/A');
        console.log('⏰ Token expires:', result.expiresAt || 'N/A');
        return result.connected;
    } else {
        console.log('❌ Failed to get integration status');
        return false;
    }
};

const testCreateEvent = async () => {
    console.log('\n📅 Testing event creation with Google sync...');

    if (!PROJECT_ID) {
        console.log('❌ TEST_PROJECT_ID not set in environment');
        return false;
    }

    const eventData = {
        projectId: PROJECT_ID,
        title: `Test Meeting - ${new Date().toISOString()}`,
        startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        endAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        location: 'Online',
        meetLink: 'https://meet.google.com/test-meeting',
        syncToGoogle: true,
        participantEmails: ['test@example.com']
    };

    const result = await apiRequest('POST', '/events', eventData);

    if (result && result.id) {
        console.log('✅ Event created successfully');
        console.log('🆔 Event ID:', result.id);
        console.log('📝 Title:', result.title);
        console.log('⏰ Start:', result.startAt);
        console.log('👥 Participants:', result.participants?.length || 0);
        return result.id;
    } else {
        console.log('❌ Failed to create event');
        return null;
    }
};

const testSyncEvents = async () => {
    console.log('\n🔄 Testing calendar sync...');
    const result = await apiRequest('POST', '/calendar/sync');

    if (result) {
        console.log('✅ Calendar sync completed');
        console.log('📈 Synced events:', result.syncedCount || 0);
        console.log('⚠️  Errors:', result.errors?.length || 0);
        return true;
    } else {
        console.log('❌ Calendar sync failed');
        return false;
    }
};

const testDisconnect = async () => {
    console.log('\n🔌 Testing Google Calendar disconnect...');
    const result = await apiRequest('POST', '/calendar/disconnect');

    if (result && result.success) {
        console.log('✅ Successfully disconnected from Google Calendar');
        return true;
    } else {
        console.log('❌ Failed to disconnect');
        return false;
    }
};

// Interactive test runner
const runInteractiveTests = async () => {
    console.log('🧪 Google Calendar Integration Test Suite');
    console.log('========================================\n');

    // Check prerequisites
    if (!FIREBASE_TOKEN) {
        console.log('❌ FIREBASE_TOKEN environment variable not set');
        console.log('Please set your Firebase authentication token');
        process.exit(1);
    }

    console.log('📋 Configuration:');
    console.log('🌐 API Base URL:', API_BASE_URL);
    console.log('🔐 Firebase Token:', FIREBASE_TOKEN ? '✅ Set' : '❌ Not set');
    console.log('📁 Project ID:', PROJECT_ID || '⚠️  Not set (some tests will skip)');

    // Test 1: Get Auth URL
    const authUrl = await testGetAuthUrl();
    if (!authUrl) return;

    // Interactive OAuth flow
    console.log('\n⏳ Please complete OAuth authorization in your browser...');
    const authCode = await new Promise((resolve) => {
        rl.question('Enter the authorization code from the callback URL: ', resolve);
    });

    // Test 2: OAuth Callback
    const oauthSuccess = await testOAuthCallback(authCode);
    if (!oauthSuccess) return;

    // Test 3: Integration Status
    const isConnected = await testIntegrationStatus();
    if (!isConnected) return;

    // Test 4: Create Event
    const eventId = await testCreateEvent();

    // Test 5: Sync Events
    await testSyncEvents();

    // Optional: Test disconnect
    const shouldDisconnect = await new Promise((resolve) => {
        rl.question('\nDo you want to test disconnect? (y/N): ', (answer) => {
            resolve(answer.toLowerCase() === 'y');
        });
    });

    if (shouldDisconnect) {
        await testDisconnect();
    }

    console.log('\n✨ Test suite completed!');
    rl.close();
};

// Non-interactive test for CI/CD
const runAutomatedTests = async () => {
    console.log('🤖 Running automated tests (non-interactive)...');

    // Test integration status
    await testIntegrationStatus();

    // Test create event (if connected)
    await testCreateEvent();

    // Test sync
    await testSyncEvents();

    console.log('✅ Automated tests completed');
};

// Main execution
const main = async () => {
    const isInteractive = process.argv.includes('--interactive');

    if (isInteractive) {
        await runInteractiveTests();
    } else {
        await runAutomatedTests();
    }
};

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testGetAuthUrl,
    testOAuthCallback,
    testIntegrationStatus,
    testCreateEvent,
    testSyncEvents,
    testDisconnect
};