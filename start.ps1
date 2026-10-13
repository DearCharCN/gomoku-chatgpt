param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$dataRoot = if ($env:GOMOKU_DATA_DIR) { [IO.Path]::GetFullPath($env:GOMOKU_DATA_DIR) } else { Join-Path $projectRoot '.local' }
$port = if ($env:PORT) { [int]$env:PORT } else { 3211 }
if ($port -lt 1 -or $port -gt 65535) { throw 'PORT must be between 1 and 65535.' }
$url = "http://127.0.0.1:$port"
$hash = [Security.Cryptography.SHA256]::Create()
$key = [BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($dataRoot.ToLowerInvariant()))).Replace('-', '')
$hash.Dispose()
# The OS releases the startup mutex even if this launcher is interrupted.
$mutex = [Threading.Mutex]::new($false, "Local\GomokuStart-$key")
$held = $false
function Test-GomokuReady {
  try {
    $reply = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
    return $reply.StatusCode -eq 200 -and $reply.Headers['X-Gomoku-Studio'] -eq '1'
  } catch { return $false }
}
try {
  try { $held = $mutex.WaitOne(15000) } catch [Threading.AbandonedMutexException] { $held = $true }
  if (-not $held) { throw 'Another launcher is starting the app. Try again shortly.' }
  if (-not (Test-GomokuReady)) {
    [IO.Directory]::CreateDirectory($dataRoot) | Out-Null
    $lockPath = Join-Path $dataRoot 'server.lock'
    if (Test-Path -LiteralPath $lockPath) {
      $lockOwner = 0
      if (-not [int]::TryParse((Get-Content -LiteralPath $lockPath -Raw).Trim(), [ref]$lockOwner) -or $lockOwner -le 0) {
        throw "Invalid lock file: $lockPath. Check that no app instance is running before removing it."
      }
      if (Get-Process -Id $lockOwner -ErrorAction SilentlyContinue) {
        throw "The app process $lockOwner still exists but is not ready at $url. Check its startup logs."
      }
      Remove-Item -LiteralPath $lockPath
    }
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $serverPath = Join-Path $projectRoot 'server.mjs'
    $outLog = Join-Path $dataRoot 'server.stdout.log'
    $errLog = Join-Path $dataRoot 'server.stderr.log'
    $service = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
      if (Test-GomokuReady) { $ready = $true; break }
      $service.Refresh()
      if ($service.HasExited) { throw "The server exited. See $errLog" }
      Start-Sleep -Milliseconds 200
    }
    if (-not $ready) { throw "The server did not become ready. See $errLog" }
  }
  Write-Output "Gomoku Studio is ready: $url"
  if (-not $NoBrowser) { Start-Process -FilePath $url -WindowStyle Hidden }
} catch {
  Write-Error $_ -ErrorAction Continue
  exit 1
} finally {
  if ($held) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
