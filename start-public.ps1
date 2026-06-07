param(
  [int]$Port = 3001
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Cloudflared = Join-Path $Root "tools\cloudflared.exe"

if (-not (Test-Path $Cloudflared)) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Root "tools") | Out-Null
  Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $Cloudflared
}

Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$Root\start.ps1`"",
  "-Port",
  "$Port"
) -WorkingDirectory $Root

Start-Sleep -Seconds 2
& $Cloudflared tunnel --url "http://localhost:$Port" --no-autoupdate
