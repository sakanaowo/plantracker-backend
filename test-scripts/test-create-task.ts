// Test creating a task via API to see if activity log is triggered
import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjdlYTA5ZDA1NzI2MmU2M2U2MmZmNzNmMDNlMDRhZDI5ZDg5Zjg5MmEiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3BsYW50cmFja2VyLTU5MGY1IiwiYXVkIjoicGxhbnRyYWNrZXItNTkwZjUiLCJhdXRoX3RpbWUiOjE3NjE3MTk4NjMsInVzZXJfaWQiOiJRSWo3NGdDUUJLZkNvdDZxY3pnNGxKSFR1bTQzIiwic3ViIjoiUUlqNzRnQ1FCS2ZDb3Q2cWN6ZzRsSkhUdW00MyIsImlhdCI6MTc2MTcxOTg2MywiZXhwIjoxNzYxNzIzNDYzLCJlbWFpbCI6ImFkbWluMUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsiYWRtaW4xQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.WnLmKZLxE7AmY21BJBFrBI_nHWM2-O_22_pyQS33vIAFEG3pb4JgigfNHm42oBXShOy1kD0wNr-QKsdY9h3hdOwhQY83ZsitB8tiiSq3pkcen33RMkPTVM7-naQsm0RmQaaLQEZrNC6jwwsspHgSlBRPqq2yoP41_F0CyK2fa4-u0FXGltjig3gpjardkyNtushgHHZtQh_Y3xOJjE_jCG1k6m3uFFKBKMmEjGaUViZBbSgNNePt6Usn_K1vVAA4zG2GM0RCQ1nX0faA5yE2juoT3eor0fOk0xZUwfp1tL0jwCBcpFhveEUWwH3JWcYk-wYYeP2euq2dV6VHTBOUWA';

async function testCreateTask() {
  try {
    console.log('Creating a test task...\n');

    // Use known IDs from database
    const projectId = 'de59804b-df6e-4c17-992c-0616b1ec2f08'; // Default Project
    const boardId = '4ccb9152-598e-464e-b557-ddae91afa90e'; // To Do board

    // Create task
    const taskData = {
      projectId: projectId,
      boardId: boardId,
      title: `Test Activity Log Task ${Date.now()}`,
      description: 'Testing if activity log is triggered',
    };

    console.log('Task data:', JSON.stringify(taskData, null, 2));

    const response = await axios.post(`${BASE_URL}/tasks`, taskData, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('\n✅ Task created successfully!');
    console.log('Task ID:', response.data.id);
    console.log('Task Title:', response.data.title);

    // Wait a bit for activity log to be created
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check activity logs
    console.log('\n--- Checking Activity Logs ---');
    const userId = 'a3bc3b99-7e76-4f88-8a63-37e75ebd44aa'; // admin1@gmail.com
    const logsResponse = await axios.get(`${BASE_URL}/activity-logs/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
      },
    });

    console.log(`Found ${logsResponse.data.length} activity logs`);
    if (logsResponse.data.length > 0) {
      console.log('\nLatest activity log:');
      console.log(JSON.stringify(logsResponse.data[0], null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testCreateTask();
