#!/bin/bash

# T-Bank Integration Email Test Script
# Usage: ./test-email.sh [test-type]
# test-type: status|connection|send

set -e

TEST_TYPE=${1:-status}
BASE_URL=${TBANK_BASE_URL:-http://localhost:8083}
API_TOKEN=${TBANK_API_TOKEN:-}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                T-Bank Email Test Script                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

check_service() {
    echo "Checking if T-Bank Integration service is running..."
    
    if curl -s -f "$BASE_URL/health" > /dev/null; then
        print_status "Service is running at $BASE_URL"
    else
        print_error "Service is not running at $BASE_URL"
        echo "Please start the service first:"
        echo "  cd tbank-integration && cargo run"
        exit 1
    fi
}

test_email_status() {
    echo ""
    echo -e "${BLUE}Testing Email Status...${NC}"
    echo "========================"
    
    local response=$(curl -s -X GET "$BASE_URL/api/v1/email/status" \
        -H "Content-Type: application/json" \
        ${API_TOKEN:+-H "Authorization: Bearer $API_TOKEN"})
    
    if [ $? -eq 0 ]; then
        echo "Response:"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        
        local enabled=$(echo "$response" | jq -r '.enabled' 2>/dev/null || echo "unknown")
        if [ "$enabled" = "true" ]; then
            print_status "Email is enabled"
        elif [ "$enabled" = "false" ]; then
            print_warning "Email is disabled"
        else
            print_warning "Could not determine email status"
        fi
    else
        print_error "Failed to get email status"
        return 1
    fi
}

test_email_connection() {
    echo ""
    echo -e "${BLUE}Testing Email Connection...${NC}"
    echo "==========================="
    
    local response=$(curl -s -X POST "$BASE_URL/api/v1/email/test-connection" \
        -H "Content-Type: application/json" \
        ${API_TOKEN:+-H "Authorization: Bearer $API_TOKEN"})
    
    if [ $? -eq 0 ]; then
        echo "Response:"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        
        local success=$(echo "$response" | jq -r '.success' 2>/dev/null || echo "unknown")
        if [ "$success" = "true" ]; then
            print_status "Email connection test successful"
        else
            print_error "Email connection test failed"
            local message=$(echo "$response" | jq -r '.message' 2>/dev/null || echo "Unknown error")
            echo "Error: $message"
        fi
    else
        print_error "Failed to test email connection"
        return 1
    fi
}

send_test_email() {
    echo ""
    echo -e "${BLUE}Sending Test Email...${NC}"
    echo "====================="
    
    local subject="T-Bank Integration Test - $(date '+%Y-%m-%d %H:%M:%S')"
    local message="This is a test email sent from the T-Bank Integration test script.

Environment Variables:
- TBANK_EMAIL_ENABLED: ${TBANK_EMAIL_ENABLED:-not set}
- TBANK_EMAIL_SMTP_SERVER: ${TBANK_EMAIL_SMTP_SERVER:-not set}
- TBANK_EMAIL_FROM_ADDRESS: ${TBANK_EMAIL_FROM_ADDRESS:-not set}

If you received this email, the email configuration is working correctly!"

    local payload=$(jq -n \
        --arg subject "$subject" \
        --arg message "$message" \
        '{subject: $subject, message: $message}')
    
    local response=$(curl -s -X POST "$BASE_URL/api/v1/email/test" \
        -H "Content-Type: application/json" \
        ${API_TOKEN:+-H "Authorization: Bearer $API_TOKEN"} \
        -d "$payload")
    
    if [ $? -eq 0 ]; then
        echo "Response:"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        
        local success=$(echo "$response" | jq -r '.success' 2>/dev/null || echo "unknown")
        if [ "$success" = "true" ]; then
            print_status "Test email sent successfully"
            echo "Check your email inbox for the test message."
        else
            print_error "Failed to send test email"
            local message=$(echo "$response" | jq -r '.message' 2>/dev/null || echo "Unknown error")
            echo "Error: $message"
        fi
    else
        print_error "Failed to send test email"
        return 1
    fi
}

show_environment_info() {
    echo ""
    echo -e "${BLUE}Current Email Environment:${NC}"
    echo "=========================="
    
    echo "Environment Variables:"
    echo "- TBANK_EMAIL_ENABLED: ${TBANK_EMAIL_ENABLED:-not set}"
    echo "- TBANK_EMAIL_SMTP_SERVER: ${TBANK_EMAIL_SMTP_SERVER:-not set}"
    echo "- TBANK_EMAIL_SMTP_PORT: ${TBANK_EMAIL_SMTP_PORT:-not set}"
    echo "- TBANK_EMAIL_USERNAME: ${TBANK_EMAIL_USERNAME:-not set}"
    echo "- TBANK_EMAIL_FROM_ADDRESS: ${TBANK_EMAIL_FROM_ADDRESS:-not set}"
    echo "- TBANK_EMAIL_TO_ADDRESSES: ${TBANK_EMAIL_TO_ADDRESSES:-not set}"
    echo "- TBANK_EMAIL_USE_TLS: ${TBANK_EMAIL_USE_TLS:-not set}"
    
    echo ""
    echo "Expected Configuration:"
    echo "- SMTP Server: smtp.rusender.ru"
    echo "- SMTP Port: 465"
    echo "- Username: noreply@ad-quest.ru"
    echo "- Use TLS: true"
}

run_all_tests() {
    test_email_status
    test_email_connection
    send_test_email
}

show_usage() {
    echo "Usage: $0 [test-type]"
    echo ""
    echo "Test types:"
    echo "  status     - Check email configuration status (default)"
    echo "  connection - Test SMTP connection"
    echo "  send       - Send test email"
    echo "  all        - Run all tests"
    echo "  env        - Show environment variables"
    echo ""
    echo "Environment variables:"
    echo "  TBANK_BASE_URL - Base URL for T-Bank service (default: http://localhost:8083)"
    echo "  TBANK_API_TOKEN - API token for authentication (optional)"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 send"
    echo "  TBANK_BASE_URL=http://localhost:8080 $0 all"
}

main() {
    print_header
    
    case "$TEST_TYPE" in
        "status")
            check_service
            test_email_status
            ;;
        "connection")
            check_service
            test_email_connection
            ;;
        "send")
            check_service
            send_test_email
            ;;
        "all")
            check_service
            run_all_tests
            ;;
        "env")
            show_environment_info
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            print_error "Unknown test type: $TEST_TYPE"
            echo ""
            show_usage
            exit 1
            ;;
    esac
    
    echo ""
    print_status "Email test completed!"
}

# Check if jq is available
if ! command -v jq &> /dev/null; then
    print_warning "jq is not installed. JSON responses will not be formatted."
    print_warning "Install jq for better output: sudo apt-get install jq"
fi

# Run main function
main