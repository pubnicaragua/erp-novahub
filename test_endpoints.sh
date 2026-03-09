#!/bin/bash

# Variables
BASE_URL="http://localhost:3000/users"

echo "--- 1. CREANDO USUARIO ADMIN ---"
curl -X POST $BASE_URL \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@novahub.com",
       "password": "Password123",
       "name": "Admin Nova",
       "role": "ADMIN"
     }'
echo -e "\n"

echo "--- 2. OBTENIENDO TODOS LOS USUARIOS ---"
curl -X GET $BASE_URL
echo -e "\n"

echo "--- 3. PRUEBA DE ERROR (Email Duplicado) ---"
curl -X POST $BASE_URL \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@novahub.com",
       "password": "otra",
       "name": "Intento Fallido"
     }'
echo -e "\n"