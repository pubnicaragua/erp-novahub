#!/bin/bash

# Base URL for the NestJS API
API_URL="http://localhost:3000"

echo "=========================================="
echo "    Testing Novahub ERP Endpoints"
echo "=========================================="

# --- 1. LOGIN ---
echo -e "\n1. Testing POST /auth/login (Auth)"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@novahub.com",
    "password": "SecurePass123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -oP '"access_token":"\K[^"]+')

if [ -z "$TOKEN" ]; then
  echo "Error: Could not obtain Access Token. Make sure the user exists and the local server is running."
  # For testing purposes, we'll continue with placeholder if needed, but ideally it should fail
  TOKEN="PLACEHOLDER_TOKEN"
fi

echo "Access Token obtained: ${TOKEN:0:15}..."
echo "------------------------------------------"

# --- 2. USERS ---
echo -e "\n2. Testing GET /users (List Users)"
curl -s -X GET "$API_URL/users" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

# --- 3. PROJECTS ---
echo -e "\n3. Testing POST /projects (Create Project)"
PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Architecture Studio Redesign",
    "description": "Redesigning the main studio layout",
    "status": "DRAFT",
    "startDate": "2026-03-01T00:00:00.000Z",
    "budget": 50000
  }')
echo "Project Response: $PROJECT_RESPONSE"
echo "------------------------------------------"

# --- 4. SALES ---
echo -e "\n4. Testing POST /sales/customers (Create Customer)"
curl -s -X POST "$API_URL/sales/customers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Enterprise Client Inc",
    "email": "contact@enterprise.com",
    "type": "COMPANY"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n5. Testing GET /sales/invoices (List Invoices)"
curl -s -X GET "$API_URL/sales/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}\n"

echo "=========================================="
echo "          Tests Completed"
echo "=========================================="
