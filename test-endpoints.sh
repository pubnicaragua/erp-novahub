#!/bin/bash

# Base URL for the NestJS API
API_URL="http://localhost:3000"

echo "=========================================="
echo "    Testing Novahub ERP Endpoints"
echo "=========================================="

echo -e "\n1. Testing GET / (AppController)"
curl -s -X GET "$API_URL/" -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n2. Testing POST /users (Create User)"
# Dummy UUIDs are used for tenantId since it's required in CreateUserDto
curl -s -X POST "$API_URL/users" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "email": "test_user_api@novahub.com",
    "passwordHash": "SecurePass123",
    "name": "Api Test User"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n3. Testing GET /users (Get all Users)"
curl -s -X GET "$API_URL/users" -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n4. Testing GET /users/{id} (Get one User)"
echo "Note: Attempting to get user with ID 1 (Might return 404 or an error if invalid format for ID)"
curl -s -X GET "$API_URL/users/1" -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n5. Testing PATCH /users/{id} (Update User)"
curl -s -X PATCH "$API_URL/users/1" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Api Test User"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n6. Testing DELETE /users/{id} (Delete User)"
curl -s -X DELETE "$API_URL/users/1" -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n7. Testing POST /ventas (Create Venta)"
curl -s -X POST "$API_URL/ventas" \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "123e4567-e89b-12d3-a456-426614174001",
    "fecha": "2026-03-10T00:00:00.000Z",
    "items": [
      {
        "descripcion": "Product API Test",
        "cantidad": 2,
        "precioUnitario": 50.0
      }
    ]
  }' \
  -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n8. Testing GET /ventas (Get all Ventas)"
curl -s -X GET "$API_URL/ventas" -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n9. Testing GET /ventas/{id} (Get one Venta)"
echo "Note: Attempting to get venta with ID 1"
curl -s -X GET "$API_URL/ventas/1" -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n10. Testing PATCH /ventas/{id} (Update Venta)"
curl -s -X PATCH "$API_URL/ventas/1" \
  -H "Content-Type: application/json" \
  -d '{
    "estado": "CONFIRMADA"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
echo "------------------------------------------"

echo -e "\n11. Testing DELETE /ventas/{id} (Delete Venta)"
curl -s -X DELETE "$API_URL/ventas/1" -w "\nHTTP Status: %{http_code}\n"
echo "=========================================="
echo "          Tests Completed"
echo "=========================================="
