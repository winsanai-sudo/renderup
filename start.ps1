param(
  [int]$Port = 3001,
  [string]$MasterCode = ""
)

$ErrorActionPreference = "Stop"
$BundledNode = "C:\Users\JK\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$NodeCommand = $null

try {
  $Candidate = Get-Command node -ErrorAction Stop
  & $Candidate.Source --version | Out-Null
  $NodeCommand = $Candidate.Source
} catch {
  if (Test-Path $BundledNode) {
    $NodeCommand = $BundledNode
  }
}

if (-not $NodeCommand) {
  throw "Node.js를 찾을 수 없습니다."
}

if (-not $MasterCode) {
  $MasterCodePath = Join-Path $PSScriptRoot "data\master-code.txt"
  if (Test-Path $MasterCodePath) {
    $MasterCode = (Get-Content -LiteralPath $MasterCodePath -Raw).Trim()
  }
}

$env:PORT = "$Port"
if ($MasterCode) {
  $env:MASTER_CODE = $MasterCode
}
& $NodeCommand server.js
