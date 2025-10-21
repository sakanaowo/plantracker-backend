# Worker Endpoints Testing Script
# Run this script after starting the server: npm run start:dev

$baseUrl = "http://localhost:3000"
$workerToken = "your_token_from_env_file"  # Replace with actual token from .env

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Worker Endpoints Testing" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Testing Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/worker/health" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $workerToken"
            "Content-Type" = "application/json"
        }
    
    Write-Host "✅ Health Check: PASSED" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json
} catch {
    Write-Host "❌ Health Check: FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""

# Test 2: Unauthorized Access (No Token)
Write-Host "2. Testing Unauthorized Access (No Token)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/worker/health" `
        -Method Post `
        -Headers @{
            "Content-Type" = "application/json"
        }
    
    Write-Host "❌ Should have returned 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Unauthorized Access: PASSED (401 returned)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected status code" -ForegroundColor Red
    }
}
Write-Host ""

# Test 3: Unauthorized Access (Wrong Token)
Write-Host "3. Testing Unauthorized Access (Wrong Token)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/worker/health" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer wrong_token_123"
            "Content-Type" = "application/json"
        }
    
    Write-Host "❌ Should have returned 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Wrong Token: PASSED (401 returned)" -ForegroundColor Green
    } else {
        Write-Host "❌ Unexpected status code" -ForegroundColor Red
    }
}
Write-Host ""

# Test 4: Upcoming Reminders (may fail if no FCM setup)
Write-Host "4. Testing Upcoming Reminders..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/worker/upcoming-reminders" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $workerToken"
            "Content-Type" = "application/json"
        }
    
    Write-Host "✅ Upcoming Reminders: PASSED" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json
} catch {
    Write-Host "⚠️ Upcoming Reminders: ERROR (May need FCM setup)" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}
Write-Host ""

# Test 5: Overdue Reminders
Write-Host "5. Testing Overdue Reminders..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/worker/overdue-reminders" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $workerToken"
            "Content-Type" = "application/json"
        }
    
    Write-Host "✅ Overdue Reminders: PASSED" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json
} catch {
    Write-Host "⚠️ Overdue Reminders: ERROR (May need FCM setup)" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}
Write-Host ""

# Test 6: Daily Summary
Write-Host "6. Testing Daily Summary..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/worker/daily-summary" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $workerToken"
            "Content-Type" = "application/json"
        }
    
    Write-Host "✅ Daily Summary: PASSED" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $response | ConvertTo-Json
} catch {
    Write-Host "⚠️ Daily Summary: ERROR (May need FCM setup)" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}
Write-Host ""

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
