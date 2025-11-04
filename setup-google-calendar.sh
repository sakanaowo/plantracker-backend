#!/bin/bash

# Google Calendar Integration Setup & Test Script
# This script helps setup and test the Google Calendar integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        log_error "Please run this script from the plantracker-backend directory"
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check if npm packages are installed
    if [[ ! -d "node_modules" ]]; then
        log_warning "Node modules not found. Installing..."
        npm install
    fi
    
    log_success "Prerequisites checked"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment..."
    
    # Check if .env exists
    if [[ ! -f ".env" ]]; then
        log_warning ".env file not found"
        
        # Copy from template if available
        if [[ -f ".env.google-calendar" ]]; then
            log_info "Copying environment template..."
            cp .env.google-calendar .env
            log_warning "Please edit .env file with your actual Google OAuth credentials"
        else
            log_error "No environment template found. Please create .env file manually"
            exit 1
        fi
    else
        log_success ".env file exists"
    fi
    
    # Check for required Google OAuth variables
    if ! grep -q "GOOGLE_CLIENT_ID=" .env || ! grep -q "GOOGLE_CLIENT_SECRET=" .env; then
        log_error "Google OAuth credentials not configured in .env"
        log_info "Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file"
        exit 1
    fi
    
    log_success "Environment setup complete"
}

# Build the application
build_application() {
    log_info "Building application..."
    
    if npm run build; then
        log_success "Application built successfully"
    else
        log_error "Build failed. Please fix TypeScript errors"
        exit 1
    fi
}

# Start development server
start_dev_server() {
    log_info "Starting development server..."
    
    # Check if server is already running
    if curl -s http://localhost:3000/api/health/db &> /dev/null; then
        log_success "Server is already running"
        return 0
    fi
    
    log_info "Starting server in background..."
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to start
    log_info "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/health/db &> /dev/null; then
            log_success "Server started successfully (PID: $SERVER_PID)"
            echo $SERVER_PID > .server.pid
            return 0
        fi
        sleep 1
    done
    
    log_error "Server failed to start within 30 seconds"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
}

# Test API endpoints
test_endpoints() {
    log_info "Testing API endpoints..."
    
    # Test health endpoint
    if curl -s http://localhost:3000/api/health/db | grep -q "ok"; then
        log_success "Health endpoint working"
    else
        log_error "Health endpoint not responding"
        return 1
    fi
    
    # Test Swagger docs
    if curl -s http://localhost:3000/api/docs | grep -q "swagger"; then
        log_success "Swagger documentation available"
    else
        log_warning "Swagger documentation might not be available"
    fi
    
    log_success "Basic endpoint tests passed"
}

# Interactive OAuth test
test_oauth_flow() {
    log_info "Testing OAuth flow (requires Firebase token)..."
    
    # Check if we have a Firebase token for testing
    if [[ -z "$FIREBASE_TOKEN" ]]; then
        log_warning "FIREBASE_TOKEN not set. Skipping OAuth test"
        log_info "To test OAuth, set FIREBASE_TOKEN environment variable with a valid Firebase JWT"
        return 0
    fi
    
    # Test auth URL endpoint
    AUTH_URL_RESPONSE=$(curl -s -H "Authorization: Bearer $FIREBASE_TOKEN" \
        http://localhost:3000/api/calendar/google/auth-url)
    
    if echo "$AUTH_URL_RESPONSE" | grep -q "authUrl"; then
        log_success "OAuth auth URL endpoint working"
        
        # Extract and display the auth URL
        AUTH_URL=$(echo "$AUTH_URL_RESPONSE" | grep -o '"authUrl":"[^"]*"' | cut -d'"' -f4)
        log_info "🔗 Visit this URL to authorize: $AUTH_URL"
    else
        log_error "OAuth auth URL endpoint failed"
        echo "Response: $AUTH_URL_RESPONSE"
    fi
}

# Stop development server
stop_dev_server() {
    if [[ -f ".server.pid" ]]; then
        SERVER_PID=$(cat .server.pid)
        if kill $SERVER_PID 2>/dev/null; then
            log_success "Server stopped (PID: $SERVER_PID)"
        else
            log_warning "Server process not found or already stopped"
        fi
        rm -f .server.pid
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    stop_dev_server
}

# Trap cleanup on exit
trap cleanup EXIT

# Main execution
main() {
    echo "🧪 Google Calendar Integration Setup & Test"
    echo "=========================================="
    echo
    
    check_prerequisites
    setup_environment
    build_application
    start_dev_server
    
    # Give server time to fully start
    sleep 2
    
    test_endpoints
    test_oauth_flow
    
    echo
    log_success "Setup and basic tests completed!"
    echo
    log_info "Next steps:"
    echo "1. Visit http://localhost:3000/api/docs to explore the API"
    echo "2. Set FIREBASE_TOKEN environment variable to test authenticated endpoints"
    echo "3. Use the test script: node _test-scripts/test-google-calendar.js --interactive"
    echo
    log_info "Server is running at: http://localhost:3000/api"
    log_info "Swagger docs at: http://localhost:3000/api/docs"
    echo
    
    # Ask if user wants to keep server running
    read -p "Keep server running? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Server will continue running in background"
        log_info "To stop later, run: kill $(cat .server.pid)"
        # Don't cleanup on exit if keeping server running
        trap - EXIT
    else
        log_info "Stopping server..."
    fi
}

# Handle command line arguments
case "${1:-}" in
    "start")
        start_dev_server
        ;;
    "stop")
        stop_dev_server
        ;;
    "test")
        test_endpoints
        test_oauth_flow
        ;;
    "build")
        build_application
        ;;
    *)
        main
        ;;
esac