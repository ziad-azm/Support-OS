<#
.SYNOPSIS
    Starts the full SupportOS local dev stack: Django backend, Celery worker,
    Celery beat, and the Vite frontend - each in its own PowerShell window.

.DESCRIPTION
    Mirrors README.md §§ 3-6 exactly (the non-Docker path): same commands,
    same working directories, same --pool=solo flag on Windows. This script
    only launches them in parallel; it assumes PostgreSQL and Redis are
    already running locally (README.md §§ 1 and 6).

.USAGE
    From the repo root:  .\dev.ps1
#>

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$venvActivate = Join-Path $backend '.venv\Scripts\Activate.ps1'

if (-not (Test-Path $venvActivate)) {
    Write-Host "Backend venv not found at $venvActivate" -ForegroundColor Red
    Write-Host "Run the backend setup steps in README.md § 3 first (python -m venv .venv, pip install -r requirements.txt)." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Write-Host "frontend/node_modules not found." -ForegroundColor Red
    Write-Host "Run 'npm install' in frontend/ first (README.md § 4)." -ForegroundColor Yellow
    exit 1
}

try {
    $redisTest = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
    if (-not $redisTest.TcpTestSucceeded) {
        Write-Host "Warning: nothing answering on localhost:6379 (Redis)." -ForegroundColor Yellow
        Write-Host "Celery worker/beat will start but tasks will fail until Redis is running (README.md § 6)." -ForegroundColor Yellow
    }
} catch {
    # Best-effort check only - never block the stack from starting over it.
}

function Start-DevWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-Command',
        "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$WorkingDirectory'; $Command"
    ) | Out-Null
}

Write-Host "Starting SupportOS dev stack (4 windows)..." -ForegroundColor Cyan

Start-DevWindow -Title 'SupportOS - Backend (8000)' -WorkingDirectory $backend `
    -Command ". '$venvActivate'; python manage.py runserver"
Start-Sleep -Seconds 1

Start-DevWindow -Title 'SupportOS - Celery Worker' -WorkingDirectory $backend `
    -Command ". '$venvActivate'; celery -A config worker -l info --pool=solo"
Start-Sleep -Seconds 1

Start-DevWindow -Title 'SupportOS - Celery Beat' -WorkingDirectory $backend `
    -Command ". '$venvActivate'; celery -A config beat -l info"
Start-Sleep -Seconds 1

Start-DevWindow -Title 'SupportOS - Frontend (5173)' -WorkingDirectory $frontend `
    -Command 'npm run dev'

Write-Host ""
Write-Host "Launched: Backend (http://127.0.0.1:8000), Celery worker, Celery beat, Frontend (http://localhost:5173)." -ForegroundColor Green
Write-Host "Each is running in its own window - close a window (or Ctrl+C inside it) to stop that one process." -ForegroundColor Green
