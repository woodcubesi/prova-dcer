param(
    [string]$PostgresRoot = (Join-Path $env:LOCALAPPDATA 'DevTools\PostgreSQL\16.15\pgsql'),
    [string]$InnoCompiler = (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe'),
    [switch]$SkipBuild,
    [switch]$Resume
)
$ErrorActionPreference='Stop'
$repoRoot=Split-Path -Parent $PSScriptRoot
$appRoot=Join-Path $repoRoot 'provas-dcer'
$buildRoot=Join-Path $repoRoot 'build\windows'
$payload=Join-Path $buildRoot 'payload'
$dist=Join-Path $repoRoot 'dist'
function Copy-Tree([string]$Source,[string]$Destination) {
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    & robocopy.exe $Source $Destination /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "Falha ao copiar $Source ($LASTEXITCODE)." }
}
if (-not $SkipBuild) {
    Push-Location $appRoot
    try {
        $env:NEXT_TELEMETRY_DISABLED='1'
        $env:WINDOWS_STANDALONE='1'
        & npx.cmd --yes pnpm@10.11.0 build
        if ($LASTEXITCODE -ne 0) { throw 'Build Next.js falhou.' }
    } finally { Pop-Location }
}
if ((Test-Path -LiteralPath $payload) -and -not $Resume) { throw "Payload ja existe em $payload. Use -Resume para atualizar o pacote existente." }
New-Item -ItemType Directory -Force -Path $payload,$dist | Out-Null
$standalone=Join-Path $appRoot '.next\standalone'
if (-not (Test-Path (Join-Path $standalone 'server.js'))) { throw 'Build standalone nao encontrado.' }
Copy-Tree $standalone (Join-Path $payload 'app')
# Windows standalone junctions are materialized; expose their traced dependencies
# at the new root so relocation does not depend on pnpm's original directory.
Copy-Tree (Join-Path $standalone 'node_modules\.pnpm\node_modules') (Join-Path $payload 'app\node_modules')
Copy-Tree (Join-Path $appRoot '.next\static') (Join-Path $payload 'app\.next\static')
Copy-Tree (Join-Path $appRoot 'public') (Join-Path $payload 'app\public')
foreach($part in @('bin','lib','share')) { Copy-Tree (Join-Path $PostgresRoot $part) (Join-Path $payload "postgresql\$part") }
New-Item -ItemType Directory -Force -Path (Join-Path $payload 'node'),(Join-Path $payload 'windows') | Out-Null
$nodePath=(Get-Command node.exe).Source
Copy-Item -LiteralPath $nodePath -Destination (Join-Path $payload 'node\node.exe')
foreach($licenseFile in @('LICENSE','LICENSE.txt')) {
    $licensePath=Join-Path (Split-Path -Parent $nodePath) $licenseFile
    if(Test-Path $licensePath){ Copy-Item -LiteralPath $licensePath -Destination (Join-Path $payload 'node') }
}
Get-ChildItem -LiteralPath $PostgresRoot -File -Filter '*license*' | Copy-Item -Destination (Join-Path $payload 'postgresql')
$redistRoot='C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Redist\MSVC'
$crt=Get-ChildItem $redistRoot -Directory | Where-Object { $_.Name -match '^\d+\.' } | Sort-Object Name -Descending | Select-Object -First 1
$crtPath=Join-Path $crt.FullName 'x64\Microsoft.VC143.CRT'
Get-ChildItem $crtPath -Filter '*.dll' | Copy-Item -Destination (Join-Path $payload 'postgresql\bin')
Get-ChildItem $crtPath -Filter '*.dll' | Copy-Item -Destination (Join-Path $payload 'node')
foreach($name in @('Start-DCER.ps1','Run-Service.ps1','Configure-Service.ps1','Open-DCER.ps1','ProvasDCER.xml','monitor.cjs','crypto.cjs','bootstrap-admin.cjs','admin.sql','admin-count.sql','README-INSTALL.txt')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $payload 'windows')
}
Copy-Item -LiteralPath (Join-Path $env:LOCALAPPDATA 'DevTools\WinSW\WinSW.exe') -Destination (Join-Path $payload 'windows\ProvasDCER.exe') -Force
Copy-Item -LiteralPath (Join-Path $appRoot 'deploy\schema\system-mail-settings.sql') -Destination (Join-Path $payload 'windows\system-mail-settings.sql') -Force
Push-Location $appRoot
try {
    $sql=& .\node_modules\.bin\prisma.cmd migrate diff --from-empty --to-schema prisma/schema.prisma --script
    if($LASTEXITCODE -ne 0){throw 'Geracao do schema SQL falhou.'}
    [IO.File]::WriteAllLines((Join-Path $payload 'windows\schema.sql'), [string[]]$sql, [Text.UTF8Encoding]::new($false))
} finally { Pop-Location }
$reparse=Get-ChildItem $payload -Recurse -Force -Attributes ReparsePoint
if($reparse){throw 'O payload ainda contem links que podem apontar para a maquina de build.'}
@{gitCommit=(& git -C $repoRoot rev-parse HEAD); builtAt=(Get-Date -Format o); platform='win32-x64'; node=(& node --version)} | ConvertTo-Json | Set-Content (Join-Path $payload 'windows\build-info.json') -Encoding UTF8
& $InnoCompiler /Qp "/DPayloadPath=$payload" "/O$dist" (Join-Path $PSScriptRoot 'installer.iss')
if($LASTEXITCODE -ne 0){throw 'Compilacao do instalador falhou.'}
$installer=Join-Path $dist 'Provas-DCER-1.1.0-windows-x64-setup.exe'
$sha=(Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$installer.sha256", "$sha  $([IO.Path]::GetFileName($installer))`n")
Write-Output "INSTALLER_READY=$installer"
