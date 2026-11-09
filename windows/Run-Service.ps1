param([switch]$VerificationMode)
$ErrorActionPreference='Stop'
$installRoot=Split-Path -Parent $PSScriptRoot
$dataRoot=Join-Path $installRoot 'data'
try {
    if ($VerificationMode) {
        & (Join-Path $PSScriptRoot 'Start-DCER.ps1') -NoBrowser -SkipTrust
    } else {
        & (Join-Path $PSScriptRoot 'Start-DCER.ps1') -NoBrowser -ServiceMode
    }
    $state=Get-Content (Join-Path $dataRoot 'run-state.json') -Raw | ConvertFrom-Json
    $monitor=Get-Process -Id $state.monitorPid -ErrorAction Stop
    while (-not $monitor.HasExited) {
        Start-Sleep -Seconds 10
        & (Join-Path $installRoot 'postgresql\bin\pg_ctl.exe') -D (Join-Path $dataRoot 'database') status *> $null
        if($LASTEXITCODE -ne 0){throw 'O banco local parou de responder.'}
        $monitor.Refresh()
    }
    throw 'O processo da aplicacao foi encerrado.'
} catch {
    Write-Output $_.Exception.Message
    @{message=$_.Exception.Message;timestamp=(Get-Date -Format o)} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dataRoot 'startup-failure.json') -Encoding UTF8
    try { & (Join-Path $PSScriptRoot 'Start-DCER.ps1') -Stop } catch {}
    exit 1
}
