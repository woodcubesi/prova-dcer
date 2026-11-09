param(
    [string]$DataRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'data'),
    [int]$PublicPort = 3443,
    [int]$BackendPort = 33021,
    [int]$DatabasePort = 55433,
    [switch]$NoBrowser,
    [switch]$SkipTrust,
    [switch]$Stop,
    [switch]$RemoveCertificate,
    [switch]$ServiceMode
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$installRoot = Split-Path -Parent $PSScriptRoot
$nodeExe = Join-Path $installRoot 'node\node.exe'
$pgBin = Join-Path $installRoot 'postgresql\bin'
$settingsFile = Join-Path $DataRoot 'settings.json'
$stateFile = Join-Path $DataRoot 'run-state.json'
$pgData = Join-Path $DataRoot 'database'
$logs = Join-Path $DataRoot 'logs'
$certificateScope = if ($ServiceMode) { 'LocalMachine' } else { 'CurrentUser' }

function Save-Settings($value) {
    $value | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $settingsFile -Encoding UTF8
}
function Run-Tool([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Falha em $([IO.Path]::GetFileName($Executable)) (codigo $LASTEXITCODE). Consulte os logs em $logs." }
}
function Get-FreePort([int]$Preferred, [int[]]$Avoid) {
    if ($Avoid -contains $Preferred) { $Preferred=0 }
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Preferred)
    try { $listener.Start() } catch {
        $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 0)
        $listener.Start()
    }
    $result = $listener.LocalEndpoint.Port
    $listener.Stop()
    return $result
}
function Stop-Application {
    if (Test-Path -LiteralPath $stateFile) {
        $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.monitorPid)" -ErrorAction SilentlyContinue
        if ($process -and $process.ExecutablePath -eq $nodeExe -and $process.CommandLine.Contains((Join-Path $PSScriptRoot 'monitor.cjs'))) {
            & taskkill.exe /PID $state.monitorPid /T /F | Out-Null
        }
        Remove-Item -LiteralPath $stateFile -Force
    }
    if (Test-Path -LiteralPath (Join-Path $pgData 'postmaster.pid')) {
        & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData -m fast -w stop | Out-Null
    }
    if ($RemoveCertificate -and (Test-Path -LiteralPath $settingsFile)) {
        $existing = Get-Content -LiteralPath $settingsFile -Raw | ConvertFrom-Json
        foreach ($store in @('Root','My')) {
            $certPath = "Cert:\$certificateScope\$store\$($existing.certThumbprint)"
            if ($existing.certThumbprint -and (Test-Path $certPath)) { Remove-Item -LiteralPath $certPath -Force }
        }
    }
}
if ($Stop) { Stop-Application; exit 0 }

New-Item -ItemType Directory -Force -Path $DataRoot,$logs,(Join-Path $DataRoot 'backups'),(Join-Path $DataRoot 'restores') | Out-Null
$userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $DataRoot /inheritance:r /grant:r "*${userSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
$hash = [Security.Cryptography.SHA256]::Create()
$mutexName = 'Local\ProvasDCER-' + [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($DataRoot.ToLowerInvariant()))).Replace('-','')
$mutex = New-Object Threading.Mutex($false, $mutexName)
if (-not $mutex.WaitOne(0)) { throw 'O Provas DCER ja esta sendo inicializado. Aguarde alguns segundos.' }
Start-Transcript -Path (Join-Path $logs 'startup.log') -Append | Out-Null
try {
    $bootstrapFile = Join-Path $DataRoot 'bootstrap.json'
    $bootstrap = if (Test-Path -LiteralPath $bootstrapFile) { Get-Content $bootstrapFile -Raw | ConvertFrom-Json } else { $null }
    if (-not (Test-Path -LiteralPath $settingsFile)) {
        if (-not $bootstrap) { throw 'Configure nome, e-mail e senha do administrador inicial no instalador.' }
        $settings = [pscustomobject]@{
            publicPort=$(if (-not $PSBoundParameters.ContainsKey('PublicPort') -and $bootstrap.PSObject.Properties['publicPort']) { [int]$bootstrap.publicPort } else { $PublicPort }); backendPort=$BackendPort; dbPort=$DatabasePort
            dbPassword=(& $nodeExe (Join-Path $PSScriptRoot 'crypto.cjs'))
            sessionSecret=(& $nodeExe (Join-Path $PSScriptRoot 'crypto.cjs'))
            mfaKey=(& $nodeExe (Join-Path $PSScriptRoot 'crypto.cjs'))
            certPassword=(& $nodeExe (Join-Path $PSScriptRoot 'crypto.cjs'))
            certThumbprint=''; adminName=$bootstrap.name; adminEmail=$bootstrap.email
            smtp=[pscustomobject]@{host=''; port=587; secure=$false; user=''; password=''; from='Provas DCER <no-reply@localhost>'}
        }
        Save-Settings $settings
    }
    $settings = Get-Content -LiteralPath $settingsFile -Raw | ConvertFrom-Json
    if ($PSBoundParameters.ContainsKey('PublicPort') -and $settings.publicPort -ne $PublicPort) {
        Stop-Application
        $settings.publicPort=$PublicPort
        Save-Settings $settings
    }
    $url = "https://localhost:$($settings.publicPort)"
    if (Test-Path -LiteralPath $stateFile) {
        $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.monitorPid)" -ErrorAction SilentlyContinue
        if ($process -and $process.ExecutablePath -eq $nodeExe -and $process.CommandLine.Contains((Join-Path $PSScriptRoot 'monitor.cjs'))) {
            if (-not $NoBrowser) { Start-Process $url }
            exit 0
        }
    }
    Stop-Application
    if ($settings.publicPort -lt 1024 -or $settings.publicPort -gt 65535) { throw 'Porta publica invalida.' }
    $settings.backendPort = Get-FreePort $settings.backendPort @($settings.publicPort)
    $settings.dbPort = Get-FreePort $settings.dbPort @($settings.publicPort,$settings.backendPort)
    Save-Settings $settings

    $pfxFile = Join-Path $DataRoot 'localhost.pfx'
    $cerFile = Join-Path $DataRoot 'localhost.cer'
    if (-not (Test-Path -LiteralPath $pfxFile)) {
        $certificate = New-SelfSignedCertificate -DnsName 'localhost' -CertStoreLocation "Cert:\$certificateScope\My" -FriendlyName 'Provas DCER - somente localhost' -NotAfter (Get-Date).AddYears(3) -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -Type SSLServerAuthentication
        $password = ConvertTo-SecureString $settings.certPassword -AsPlainText -Force
        Export-PfxCertificate -Cert $certificate -FilePath $pfxFile -Password $password | Out-Null
        Export-Certificate -Cert $certificate -FilePath $cerFile | Out-Null
        $settings.certThumbprint = $certificate.Thumbprint
        Save-Settings $settings
    }
    if (-not $SkipTrust -and -not (Test-Path "Cert:\$certificateScope\Root\$($settings.certThumbprint)")) {
        Import-Certificate -FilePath $cerFile -CertStoreLocation "Cert:\$certificateScope\Root" | Out-Null
    }

    $env:PGHOST='127.0.0.1'; $env:PGPORT=[string]$settings.dbPort; $env:PGUSER='provas_dcer'; $env:PGPASSWORD=$settings.dbPassword
    if (-not (Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION'))) {
        $pwFile = Join-Path $DataRoot 'init-password.tmp'
        [IO.File]::WriteAllText($pwFile, $settings.dbPassword)
        try { Run-Tool (Join-Path $pgBin 'initdb.exe') @('-D',$pgData,'-U','provas_dcer','--auth=scram-sha-256','--encoding=UTF8','--locale=C',"--pwfile=$pwFile") }
        finally { Remove-Item -LiteralPath $pwFile -Force -ErrorAction SilentlyContinue }
    }
    & (Join-Path $pgBin 'pg_ctl.exe') -D $pgData status *> $null
    if ($LASTEXITCODE -ne 0) {
        Run-Tool (Join-Path $pgBin 'pg_ctl.exe') @('-D',$pgData,'-l',(Join-Path $logs 'postgres.log'),'-o',"-h 127.0.0.1 -p $($settings.dbPort)",'-w','start')
    }
    $psql = Join-Path $pgBin 'psql.exe'
    $exists = & $psql -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname='provas_dcer'"
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel acessar o banco local.' }
    if ($exists -ne '1') { Run-Tool (Join-Path $pgBin 'createdb.exe') @('provas_dcer') }
    $schemaExists = & $psql -d provas_dcer -At -c "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='AdminUser')"
    if ($schemaExists -ne 't') { Run-Tool $psql @('-d','provas_dcer','-1','-v','ON_ERROR_STOP=1','-f',(Join-Path $PSScriptRoot 'schema.sql')) }
    Run-Tool $psql @('-d','provas_dcer','-1','-v','ON_ERROR_STOP=1','-f',(Join-Path $PSScriptRoot 'system-mail-settings.sql'))
    Run-Tool $nodeExe @((Join-Path $PSScriptRoot 'bootstrap-admin.cjs'),$DataRoot)

    $stdout = Join-Path $logs 'application.log'
    $stderr = Join-Path $logs 'application-error.log'
    $monitor = Start-Process -FilePath $nodeExe -ArgumentList @(('"' + (Join-Path $PSScriptRoot 'monitor.cjs') + '"'),('"' + $DataRoot + '"')) -WorkingDirectory $installRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    @{monitorPid=$monitor.Id} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    $ready=$false
    for ($i=0; $i -lt 45; $i++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$($settings.backendPort)/admin/login" -TimeoutSec 3
            if ($response.StatusCode -eq 200) { $ready=$true; break }
        } catch { Start-Sleep -Seconds 1 }
        if ($monitor.HasExited) { break }
    }
    if (-not $ready) { Stop-Application; throw "A aplicacao nao iniciou. Consulte $stderr" }
    Write-Output "READY $url"
    if (-not $NoBrowser) { Start-Process "$url/admin/login" }
} catch {
    Write-Output $_.Exception.Message
    try { Stop-Application } catch { Write-Output 'Consulte os logs para encerrar os processos locais.' }
    throw
} finally {
    Stop-Transcript | Out-Null
    $mutex.ReleaseMutex(); $mutex.Dispose()
}
