param([switch]$ManageService,[switch]$OpenData)
$ErrorActionPreference='Stop'
if($ManageService) {
    Start-Process mmc.exe -ArgumentList 'services.msc' -Verb RunAs
    exit
}
if($OpenData) {
    Start-Process explorer.exe -ArgumentList ('"'+(Join-Path (Split-Path -Parent $PSScriptRoot) 'data')+'"')
    exit
}
$connection=Get-Content (Join-Path $PSScriptRoot 'connection.json') -Raw | ConvertFrom-Json
$port=[int]$connection.publicPort
if($port -lt 1024 -or $port -gt 65535){throw 'Porta invalida na configuracao local.'}
Start-Process "https://localhost:$port/admin/login"
