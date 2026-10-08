[CmdletBinding()]
param([string]$BuildDirectory = 'build')
$ErrorActionPreference = 'Stop'
$nativeRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $nativeRoot 'scripts/Signing.ps1')
$buildRoot = (Resolve-Path -LiteralPath (Join-Path $nativeRoot $BuildDirectory)).Path
$info = Get-Content -LiteralPath (Join-Path $buildRoot 'build-info.json') -Raw | ConvertFrom-Json
$reader = Join-Path (Join-Path $buildRoot $info.appDirectory) 'YueReader.exe'
$setup = Join-Path $buildRoot $info.installer
$scratch = Join-Path $buildRoot ('signing-checks-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratch | Out-Null
$script:passed = 0
function Pass([string]$Name) { $script:passed++; Write-Output "PASS $Name" }
function Expect-Failure([string]$Name, [scriptblock]$Action, [string]$Message) {
  $failure = $null
  try { & $Action | Out-Null } catch { $failure = $_.Exception.Message }
  if (-not $failure -or $failure -notlike "*$Message*") { throw "Expected failure for $Name ($Message), got: $failure" }
  Pass $Name
}
if ((Get-AuthenticodeSignature -LiteralPath $reader).Status -ne 'NotSigned') { throw 'Run these negative tests against an unsigned development build.' }
Expect-Failure 'Unsigned executable rejected' { Assert-YueSignature -Paths @($reader) -ExpectedPublisher 'CN=Test Publisher' } 'Trusted embedded Authenticode signature required'
Expect-Failure 'Empty publisher rejected' { Assert-YueSignature -Paths @($reader) -ExpectedPublisher ' ' } 'ExpectedPublisher must be'
Expect-Failure 'Missing executable rejected' { Assert-YueSignature -Paths @((Join-Path $scratch 'missing.exe')) -ExpectedPublisher 'CN=Test Publisher' } 'Signature input is missing'

# Test the real Windows verifier using the installed SDK's signed Microsoft binary.
# This binary is never signed, modified in place, or shipped with Yue.
$signTool = Get-YueSignTool
$microsoft = Get-AuthenticodeSignature -LiteralPath $signTool
$verified = @(Assert-YueSignature -Paths @($signTool) -ExpectedPublisher $microsoft.SignerCertificate.Subject)
if ($verified.Count -ne 1 -or -not $verified[0].timestampAuthority -or $verified[0].sha256.Length -ne 64) { throw 'Incomplete signature report.' }
Pass 'Trusted timestamped SDK signature accepted'
Expect-Failure 'Different publisher rejected' { Assert-YueSignature -Paths @($signTool) -ExpectedPublisher 'CN=Someone Else' } 'Unexpected publisher'
$tampered = Join-Path $scratch 'tampered-sdk.exe'
$bytes = [IO.File]::ReadAllBytes($signTool)
$bytes[4096] = $bytes[4096] -bxor 255
[IO.File]::WriteAllBytes($tampered, $bytes)
Expect-Failure 'Tampered signed executable rejected' { Assert-YueSignature -Paths @($tampered) -ExpectedPublisher $microsoft.SignerCertificate.Subject } 'Trusted embedded Authenticode signature required'

$readerHash = (Get-FileHash -LiteralPath $reader).Hash
Expect-Failure 'Missing signing identity fails closed' {
  Invoke-YueSign -Paths @($reader) -CertificateThumbprint ('0' * 40) -ExpectedPublisher 'CN=Test Publisher' -TimestampUrl 'https://example.invalid/rfc3161'
} 'Signing certificate was not found'
if ((Get-FileHash -LiteralPath $reader).Hash -ne $readerHash) { throw 'Failed signing changed the reader.' }
Pass 'Failed signing leaves input bytes unchanged'

$setupBefore = if (Test-Path -LiteralPath $setup) { (Get-FileHash -LiteralPath $setup).Hash } else { $null }
Expect-Failure 'Installer gate rejects unsigned embedded programs' {
  & (Join-Path $nativeRoot 'build.ps1') -Stage Installer -BuildDirectory $BuildDirectory -RequireSignedPayload -ExpectedPublisher 'CN=Test Publisher'
} 'Trusted embedded Authenticode signature required'
$setupAfter = if (Test-Path -LiteralPath $setup) { (Get-FileHash -LiteralPath $setup).Hash } else { $null }
if ($setupBefore -ne $setupAfter) { throw 'Rejected installer build changed the existing installer.' }
Pass 'Rejected build does not replace installer'

$destination = Join-Path $scratch 'release'
Expect-Failure 'Export rejects unsigned release' {
  & (Join-Path $nativeRoot 'scripts/Export-SignedRelease.ps1') -BuildDirectory $buildRoot -Destination $destination -ExpectedPublisher 'CN=Test Publisher'
} 'Trusted embedded Authenticode signature required'
if (Test-Path -LiteralPath $destination) { throw 'Unsigned release created a download directory.' }
Pass 'Unsigned release creates no download artifacts'
New-Item -ItemType Directory -Path $destination | Out-Null
$sentinel = Join-Path $destination 'keep.txt'
[IO.File]::WriteAllText($sentinel, 'Existing release')
Expect-Failure 'Published destination cannot be overwritten' {
  & (Join-Path $nativeRoot 'scripts/Export-SignedRelease.ps1') -BuildDirectory $buildRoot -Destination $destination -ExpectedPublisher 'CN=Test Publisher'
} 'Destination must be new'
if ([IO.File]::ReadAllText($sentinel) -ne 'Existing release') { throw 'Existing release was changed.' }
Pass 'Existing release is preserved'

$invalidBuild = Join-Path $scratch 'invalid-build'
New-Item -ItemType Directory -Path $invalidBuild | Out-Null
[IO.File]::WriteAllText((Join-Path $invalidBuild 'build-info.json'), '{"version":"1.2.1","appDirectory":"../outside","installer":"Yue-Setup-1.2.1-x64.exe"}')
Expect-Failure 'Manifest cannot escape the build directory' {
  & (Join-Path $nativeRoot 'scripts/Export-SignedRelease.ps1') -BuildDirectory $invalidBuild -Destination (Join-Path $scratch 'invalid-output') -ExpectedPublisher 'CN=Test Publisher'
} 'Invalid build manifest'
Expect-Failure 'Build output cannot escape the build directory' {
  & (Join-Path $nativeRoot 'build.ps1') -Stage App -BuildDirectory 'build/../outside-build'
} 'BuildDirectory must be'

Write-Output "Passed: $script:passed signing/release checks. No certificates, registry settings, or published downloads changed."
