# VEIL Protocol — Windows PowerShell One-Click Launcher
# Boots Anvil, deploys contracts, starts guardians, and launches Next.js

Write-Host "========================================================================" -ForegroundColor Yellow
Write-Host "  VEIL PROTOCOL — ONE-CLICK LAUNCHER (WINDOWS POWERSHELL)" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Yellow

$ROOT = $PSScriptRoot
Set-Location $ROOT

# Run the cross-platform Node.js orchestrator
node scripts/launch.mjs
