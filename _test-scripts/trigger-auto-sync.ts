import axios from 'axios';

const BASE_URL = 'http://10.0.2.2:3000/api';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjZmNzI1NDEwMWY1NmU0MWNmMzVjZTczNTE2MTZhMDQyNzJhMDMwYmQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vcGxhbnRyYWNrZXItNDJiYWMiLCJhdWQiOiJwbGFudHJhY2tlci00MmJhYyIsImF1dGhfdGltZSI6MTczMDA1NjY1MywidXNlcl9pZCI6IkNiZW9LWTV6RDNlbnN0WkkxUE5ROUtKWTdvMyIsInN1YiI6IkNiZW9LWTV6RDNlbnN0WkkxUE5ROUtKWTdvMyIsImlhdCI6MTczMDA1NjY1MywiZXhwIjoxNzMwMDYwMjUzLCJlbWFpbCI6InRlc3RlcjJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3RlcjJAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.cTz4mTEjD59mlC3MKxF-1RO3rlZiDkLgfnzrEFoUhtl9WQNB4P4rIMgMm7Dh2m-0AqcdG1G5eM4LKcjYMD-u0RfXJr_CvwvKMC6z7JhTCLPKh0xJfmgQ4bXZiVAXewokAHH32veCiYqo7VZM3rPG0QvKXJSJBv2pmpwrjdOZMSKVgJSfMgLi20wjlcdI3OA3LyPP7LbQpQ7Xg4NjIhvLc7xkQSyD99h0FBvgSFUHN-G8kPd5hgH-z6FElzWW2mH7dPX59yzPP0BXYmZIHKV4lV5U6IWkNmj8v82OlFQ_9y9kDJf4VxqKrfp0r5WjxJRy2p_Vq9_5lZP0QGfxlA';

async function triggerAutoSync() {
  try {
    console.log('Triggering auto-sync by calling /workspaces endpoint...\n');

    // Call any protected endpoint to trigger auth guard
    const response = await axios.get(`${BASE_URL}/workspaces`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    console.log('✅ Request successful!');
    console.log('Workspaces found:', response.data.length);
    
    // Now check if user was created
    console.log('\n--- User should now be auto-synced ---');
    console.log('Try the activity endpoint again in the app!');

  } catch (error: any) {
    if (error.response) {
      console.error('❌ Error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

triggerAutoSync();
