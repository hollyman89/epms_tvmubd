[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$SpecFile = "tests/canonical-pure-browser-lifecycle.spec.ts"
)

# 1. Determine frontend root directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Split-Path -Parent $scriptDir
Set-Location $frontendRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "LIVE BROWSER E2E" -ForegroundColor Green
Write-Host "Execution must run from the user's interactive Windows desktop." -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

# 2. Verify playwright.config.ts exists
$configPath = Join-Path $frontendRoot "playwright.config.ts"
if (-not (Test-Path $configPath)) {
    Write-Error "playwright.config.ts not found in $frontendRoot"
    exit 1
}

# 3. Verify chromium-live project is statically present in config
$configContent = Get-Content $configPath -Raw
if (-not ($configContent -match "name:\s*['""]chromium-live['""]")) {
    Write-Error "Project 'chromium-live' is not configured in playwright.config.ts"
    exit 1
}

# 4. Check Desktop environment (Check for isolated runner desktop)
try {
    Add-Type @'
    using System;
    using System.Runtime.InteropServices;
    using System.Text;
    public class LocalDesktopCheck {
        [DllImport("user32.dll")] public static extern IntPtr GetThreadDesktop(int dwThreadId);
        [DllImport("kernel32.dll")] public static extern int GetCurrentThreadId();
        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool GetUserObjectInformation(IntPtr hObj, int nIndex, StringBuilder pvInfo, int nLength, out int lpnLengthNeeded);
    }
'@ -ErrorAction SilentlyContinue

    $hDesk = [LocalDesktopCheck]::GetThreadDesktop([LocalDesktopCheck]::GetCurrentThreadId())
    $sbDesk = New-Object System.Text.StringBuilder 256
    $len = 0
    [LocalDesktopCheck]::GetUserObjectInformation($hDesk, 2, $sbDesk, 256, [ref]$len) | Out-Null
    $currentDesktop = $sbDesk.ToString()
    Write-Host "[CHECK] Current Windows Desktop: $currentDesktop" -ForegroundColor Gray

    if ($currentDesktop -match "^exebox-") {
        Write-Warning "DETEKSI RUNNER SANDBOX ($currentDesktop):"
        Write-Warning "Script ini sedang dijalankan dari isolated sandbox desktop, bukan interactive desktop user."
        Write-Warning "Window Chromium tidak akan terlihat di monitor fisik Anda."
        Write-Warning "Silakan buka Windows PowerShell lokal di desktop fisik Anda dan jalankan script ini secara langsung."
        exit 1
    }
} catch {
    # If Win32 inspection is unavailable, proceed
}

# 5. Execute canonical Playwright live command
$targetArg = if ($SpecFile) { $SpecFile } else { "" }
Write-Host "`n[EXEC] Running Playwright in headed mode on chromium-live..." -ForegroundColor Green
Write-Host "[EXEC] Target: $targetArg`n" -ForegroundColor Gray

if ($targetArg) {
    npx playwright test $targetArg --project=chromium-live --headed
} else {
    npx playwright test --project=chromium-live --headed
}
