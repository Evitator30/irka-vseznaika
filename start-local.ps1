$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $Project '.env.local'

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Write-Host ''
  Write-Host 'First launch: enter the existing Gemini key. It will stay only in .env.local and will not be sent to GitHub.' -ForegroundColor Cyan
  $SecureKey = Read-Host 'Gemini API key' -AsSecureString
  $Ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureKey)
  try { $Key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr) }
  if ([string]::IsNullOrWhiteSpace($Key)) { throw 'API key is empty.' }
  [IO.File]::WriteAllLines($EnvFile, @("GEMINI_API_KEY=$Key", 'GEMINI_MODEL=gemini-2.5-flash-lite'), [Text.UTF8Encoding]::new($false))
}

Set-Location -LiteralPath $Project
Start-Process 'http://127.0.0.1:4186'
node server.js
