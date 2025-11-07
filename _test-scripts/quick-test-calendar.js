#!/usr/bin/env node

/**
 * Quick Calendar OAuth Test
 * Run: node quick-test-calendar.js
 */

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const prompt = (question) => new Promise((resolve) => rl.question(question, resolve));

async function main() {
    console.log('🎯 Google Calendar OAuth Quick Test\n');

    // Step 1: Get Firebase Token
    console.log('📝 Step 1: Get Firebase Token');
    console.log('   You need a valid Firebase JWT token from a logged-in user.');
    console.log('   You can get this from:');
    console.log('   - Android app logs');
    console.log('   - Firebase Console > Authentication');
    console.log('   - Or use existing test token\n');

    const firebaseToken = await prompt('Enter Firebase Token (or press Enter to use test endpoint): ');

    if (!firebaseToken.trim()) {
        console.log('\n⚠️  No token provided. Please provide a valid Firebase token.');
        console.log('   For testing, you can:');
        console.log('   1. Create a test user in Firebase Console');
        console.log('   2. Use the Android app to login and capture the token');
        console.log('   3. Or use Postman to call auth endpoints\n');
        rl.close();
        return;
    }

    // Step 2: Test Auth URL endpoint
    console.log('\n📝 Step 2: Testing GET /auth/google/auth-url');
    console.log('   Making request...\n');

    try {
        const fetch = (await import('node-fetch')).default;

        const authUrlResponse = await fetch('http://localhost:3000/api/auth/google/auth-url', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${firebaseToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!authUrlResponse.ok) {
            const error = await authUrlResponse.text();
            console.log('❌ Failed to get auth URL');
            console.log('   Status:', authUrlResponse.status);
            console.log('   Error:', error);
            rl.close();
            return;
        }

        const authUrlData = await authUrlResponse.json();

        if (authUrlData.authUrl) {
            console.log('✅ Auth URL generated successfully!\n');
            console.log('🌐 OPEN THIS URL IN YOUR BROWSER:');
            console.log('━'.repeat(80));
            console.log(authUrlData.authUrl);
            console.log('━'.repeat(80));
            console.log('\n📋 Instructions:');
            console.log('   1. Copy the URL above');
            console.log('   2. Open it in your browser');
            console.log('   3. Sign in with your Google account');
            console.log('   4. Authorize PlanTracker to access Google Calendar');
            console.log('   5. You will be redirected to: http://localhost:3000/calendar/connected');
            console.log('   6. Check the URL parameters for success status\n');

            const continueTest = await prompt('After authorization, press Enter to check status...');

            // Step 3: Check integration status
            console.log('\n📝 Step 3: Checking integration status...');

            const statusResponse = await fetch('http://localhost:3000/api/auth/google/status', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${firebaseToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log('✅ Integration status retrieved:\n');
                console.log('   Connected:', statusData.connected || statusData.isConnected);
                console.log('   Account:', statusData.accountEmail || statusData.email);
                console.log('   Status:', statusData.status);
                console.log('   Expires:', statusData.expiresAt || 'N/A');

                if (statusData.connected || statusData.isConnected) {
                    console.log('\n🎉 SUCCESS! Google Calendar is now connected!\n');
                    console.log('✅ Test 1.1: Get Auth URL - PASSED');
                    console.log('✅ Test 1.2: Complete OAuth Flow - PASSED');
                    console.log('✅ Test 1.3: Check Integration Status - PASSED\n');
                } else {
                    console.log('\n⚠️  OAuth callback might not have completed successfully.');
                    console.log('   Check the redirect URL parameters for errors.\n');
                }
            } else {
                const error = await statusResponse.text();
                console.log('❌ Failed to get status');
                console.log('   Error:', error);
            }

        } else {
            console.log('❌ No auth URL in response');
            console.log('   Response:', authUrlData);
        }

    } catch (error) {
        console.log('❌ Error:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('\n⚠️  Cannot connect to backend server.');
            console.log('   Make sure the server is running: npm run start:dev\n');
        }
    }

    rl.close();
}

main().catch(console.error);
