[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$CertificateThumbprint,
  [Parameter(Mandatory=$true)][string]$ExpectedPublisher,
  [Parameter(Mandatory=$true)][uri]$TimestampUrl,
  [Parameter(Mandatory=$true)][string]$Destination,
  [ValidateSet('CurrentUser','LocalMachine')][string]$CertificateStore = 'CurrentUser'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts/Signing.ps1')
# A fresh build keeps signed releases separate from previews and existing downloads.
$destinationPath = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $destinationPath) { throw 'Destination must be new; published artifacts must never be overwritten.' }
$buildDirectory = 'build/signed-' + [guid]::NewGuid().ToString('N')
& (Join-Path $PSScriptRoot 'build.ps1') -Stage App -BuildDirectory $buildDirectory
$buildRoot = Join-Path $PSScriptRoot $buildDirectory
$info = Get-Content -LiteralPath (Join-Path $buildRoot 'build-info.json') -Raw | ConvertFrom-Json
$app = Join-Path $buildRoot $info.appDirectory
$signOptions = @{ CertificateThumbprint=$CertificateThumbprint; ExpectedPublisher=$ExpectedPublisher; TimestampUrl=$TimestampUrl; CertificateStore=$CertificateStore }
Invoke-YueSign -Paths @((Join-Path $app 'YueReader.exe'),(Join-Path $app 'Uninstall.exe')) @signOptions
& (Join-Path $PSScriptRoot 'build.ps1') -Stage Installer -BuildDirectory $buildDirectory -RequireSignedPayload -ExpectedPublisher $ExpectedPublisher
Invoke-YueSign -Paths @((Join-Path $buildRoot $info.installer)) @signOptions
& (Join-Path $PSScriptRoot 'scripts/Export-SignedRelease.ps1') -BuildDirectory $buildRoot -Destination $destinationPath -ExpectedPublisher $ExpectedPublisher
