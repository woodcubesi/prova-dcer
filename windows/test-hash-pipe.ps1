param([Parameter(Mandatory=$true)][string]$RuntimeRoot)
$ErrorActionPreference='Stop'
$payload=[Console]::In.ReadToEnd() | ConvertFrom-Json
$json=@{password=$payload.password} | ConvertTo-Json -Compress
$ascii=[regex]::Replace($json, '[^\x20-\x7e]', {param($match) '\u' + ([int][char]$match.Value).ToString('x4')})
$shell=New-Object -ComObject WScript.Shell
$process=$shell.Exec(('"{0}" "{1}" hash-stdin' -f (Join-Path $RuntimeRoot 'node\node.exe'),(Join-Path $RuntimeRoot 'windows\crypto.cjs')))
$process.StdIn.WriteLine($ascii)
$process.StdIn.Close()
$deadline=(Get-Date).AddSeconds(30)
while($process.Status -eq 0) {
    if((Get-Date) -gt $deadline){$process.Terminate();throw 'Timeout no teste do pipe.'}
    Start-Sleep -Milliseconds 25
}
if($process.ExitCode -ne 0){throw 'Senha rejeitada pelo helper.'}
[Console]::Out.Write($process.StdOut.ReadAll().Trim())
