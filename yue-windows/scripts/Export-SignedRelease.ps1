[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$BuildDirectory,
  [Parameter(Mandatory=$true)][string]$Destination,
  [Parameter(Mandatory=$true)][string]$ExpectedPublisher
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Signing.ps1')
Add-Type -AssemblyName System.IO.Compression.FileSystem
$buildRoot = (Resolve-Path -LiteralPath $BuildDirectory).Path
$outputRoot = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $outputRoot) { throw 'Destination must be new; published artifacts must never be overwritten.' }
$info = Get-Content -LiteralPath (Join-Path $buildRoot 'build-info.json') -Raw | ConvertFrom-Json
if ($info.version -notmatch '^\d+\.\d+\.\d+$' -or $info.appDirectory -ne "app-$($info.version)" -or $info.installer -ne "Yue-Setup-$($info.version)-x64.exe") { throw 'Invalid build manifest.' }
$appRoot = Join-Path $buildRoot $info.appDirectory
$setup = Join-Path $buildRoot $info.installer
$payload = Join-Path $buildRoot 'payload.zip'
$appFiles = @((Join-Path $appRoot 'YueReader.exe'),(Join-Path $appRoot 'Uninstall.exe'))
$signatureReport = @(Assert-YueSignature -Paths ($appFiles + @($setup)) -ExpectedPublisher $ExpectedPublisher)
foreach ($file in ($appFiles + @($setup))) {
  if ([Diagnostics.FileVersionInfo]::GetVersionInfo($file).FileVersion -ne "$($info.version).0") { throw "Release version mismatch: $file" }
}
# Compare the actual embedded payload and portable ZIP with the verified app tree.
# --verify-extract only extracts resources; it does not install or change the registry.
$verifyRoot = Join-Path $buildRoot ('verify-' + [guid]::NewGuid().ToString('N'))
$installed = Join-Path $verifyRoot 'installer'
$portable = Join-Path $verifyRoot 'portable'
New-Item -ItemType Directory -Path $verifyRoot | Out-Null
$process = Start-Process -FilePath $setup -ArgumentList @('--verify-extract',('"' + $installed + '"')) -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0) { throw 'Installer extraction check failed.' }
[IO.Compression.ZipFile]::ExtractToDirectory($payload, $portable)
$expectedFiles = @(Get-ChildItem -LiteralPath $appRoot -File -Recurse | ForEach-Object { $_.FullName.Substring($appRoot.Length + 1) } | Sort-Object)
foreach ($extracted in @($installed, $portable)) {
  $actualFiles = @(Get-ChildItem -LiteralPath $extracted -File -Recurse | ForEach-Object { $_.FullName.Substring($extracted.Length + 1) } | Sort-Object)
  if (Compare-Object $expectedFiles $actualFiles) { throw "Release payload file list differs: $extracted" }
  foreach ($relative in $expectedFiles) {
    if ((Get-FileHash -LiteralPath (Join-Path $appRoot $relative)).Hash -ne (Get-FileHash -LiteralPath (Join-Path $extracted $relative)).Hash) { throw "Release payload bytes differ: $relative" }
  }
}
# No download output is created until both signatures and payload contents pass.
New-Item -ItemType Directory -Path $outputRoot | Out-Null
$portableName = "Yue-Portable-$($info.version)-x64.zip"
Copy-Item -LiteralPath $setup -Destination (Join-Path $outputRoot $info.installer)
Copy-Item -LiteralPath $payload -Destination (Join-Path $outputRoot $portableName)
[IO.File]::WriteAllText((Join-Path $outputRoot 'SIGNATURES.json'), ($signatureReport | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
$checksums = @($info.installer, $portableName, 'SIGNATURES.json') | ForEach-Object { (Get-FileHash -LiteralPath (Join-Path $outputRoot $_) -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $_ }
[IO.File]::WriteAllLines((Join-Path $outputRoot 'SHA256SUMS.txt'), $checksums, [Text.UTF8Encoding]::new($false))
Write-Output "Verified signed installer and portable release: $outputRoot"
