# NovaHub ERP - Test de Endpoints (Simplificado)
param(
  [string]$BaseUrl = "http://localhost:3000/api",
  [string]$Email = "admin@empresa-demo.com",
  [string]$Password = "Admin2025!"
)

$ErrorActionPreference = "SilentlyContinue"
$pass = 0; $fail = 0; $results = @()

function Test-Endpoint {
  param([string]$Method, [string]$Path, [string]$Token, [hashtable]$Body = @{}, [string]$Label = "")
  $url = "$BaseUrl$Path"
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  try {
    $resp = if ($Method -eq "GET") {
      Invoke-RestMethod -Uri $url -Method GET -Headers $headers
    } else {
      Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -Body ($Body | ConvertTo-Json) -ContentType "application/json"
    }
    $script:pass++
    $results += [pscustomobject]@{ Status="OK"; Method=$Method; Path=$Path; Label=$Label }
  } catch {
    $script:fail++
    $results += [pscustomobject]@{ Status="FAIL"; Method=$Method; Path=$Path; Label=$Label }
  }
}

Write-Host "Autenticando..."
try {
  $loginResp = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{email=$Email; password=$Password} | ConvertTo-Json)
  $TOKEN = $loginResp.access_token
} catch {
  Write-Host "Error en login."
  exit 1
}

if (-not $TOKEN) { Write-Host "Login fallido."; exit 1 }
Write-Host "Token obtenido."

# Endpoints (Solo algunos para verificar)
Test-Endpoint GET  "/auth/profile"  $TOKEN -Label "Auth"
Test-Endpoint GET  "/sales/customers"  $TOKEN -Label "Ventas"
Test-Endpoint GET  "/purchases/suppliers" $TOKEN -Label "Compras"
Test-Endpoint GET  "/inventory/products" $TOKEN -Label "Inventario"
Test-Endpoint GET  "/financials/balance" $TOKEN -Label "Finanzas"
Test-Endpoint GET  "/hr/employees" $TOKEN -Label "RRHH"
Test-Endpoint GET  "/tools/tickets" $TOKEN -Label "Tools"

Write-Host "`nResultados:"
$results | Format-Table -AutoSize
Write-Host "Pasados: $pass"
Write-Host "Fallidos: $fail"
