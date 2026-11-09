param([switch]$Install,[switch]$Stop,[switch]$Uninstall,[switch]$PrepareData,[int]$PublicPort=3443)
$ErrorActionPreference='Stop'
$wrapper=Join-Path $PSScriptRoot 'ProvasDCER.exe'
$installRoot=Split-Path -Parent $PSScriptRoot
$dataRoot=Join-Path $installRoot 'data'
$service=Get-Service -Name ProvasDCER -ErrorAction SilentlyContinue
if(-not $PrepareData -and $service -and $service.Status -ne 'Stopped') {
    Stop-Service -Name ProvasDCER -ErrorAction Stop
    $service.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(60))
}
if($Stop){exit 0}
if($Uninstall) {
    if($service){ & $wrapper uninstall; if($LASTEXITCODE -ne 0){throw 'Falha ao remover o servico.'} }
    & (Join-Path $PSScriptRoot 'Start-DCER.ps1') -Stop -RemoveCertificate -ServiceMode
    exit 0
}
if(-not $Install -and -not $PrepareData){throw 'Selecione a operacao de configuracao do servico.'}
New-Item -ItemType Directory -Force -Path $dataRoot,(Join-Path $dataRoot 'logs\service') | Out-Null
& icacls.exe $dataRoot /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Falha ao configurar permissoes dos dados.'}
if($PrepareData){exit 0}
if($PublicPort -lt 1024 -or $PublicPort -gt 65535){throw 'Porta publica invalida.'}
$settingsFile=Join-Path $dataRoot 'settings.json'
if(Test-Path $settingsFile) {
    $settings=Get-Content $settingsFile -Raw | ConvertFrom-Json
    $settings.publicPort=$PublicPort
    $settings | ConvertTo-Json -Depth 6 | Set-Content $settingsFile -Encoding UTF8
}
@{publicPort=$PublicPort} | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'connection.json') -Encoding UTF8
if($service) {
    $instance=Get-CimInstance Win32_Service -Filter "Name='ProvasDCER'"
    $change=Invoke-CimMethod -InputObject $instance -MethodName Change -Arguments @{PathName=('"'+$wrapper+'"'); StartMode='Automatic'}
    if($change.ReturnValue -ne 0){throw 'Falha ao atualizar o servico existente.'}
} else {
    & $wrapper install
    if($LASTEXITCODE -ne 0){throw 'Falha ao instalar o servico Windows.'}
}
$failureFile=Join-Path $dataRoot 'startup-failure.json'
if(Test-Path -LiteralPath $failureFile){Remove-Item -LiteralPath $failureFile -Force}
Start-Service -Name ProvasDCER
$service=Get-Service -Name ProvasDCER
$service.WaitForStatus('Running',[TimeSpan]::FromSeconds(45))
$ready=$false
for($i=0;$i -lt 60;$i++) {
    if(Test-Path -LiteralPath $failureFile){
        Stop-Service -Name ProvasDCER -ErrorAction SilentlyContinue
        throw "Falha na inicializacao. Consulte $dataRoot\logs e startup-failure.json."
    }
    if(Test-Path $settingsFile) {
        $settings=Get-Content $settingsFile -Raw | ConvertFrom-Json
        try {
            $response=Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$($settings.backendPort)/admin/login" -TimeoutSec 3
            if($response.StatusCode -eq 200){$ready=$true;break}
        } catch {}
    }
    Start-Sleep -Seconds 1
}
if(-not $ready){
    Stop-Service -Name ProvasDCER -ErrorAction SilentlyContinue
    throw "O servico foi registrado, mas a aplicacao nao respondeu. Consulte $dataRoot\logs."
}
Write-Output "SERVICE_READY https://localhost:$PublicPort"
