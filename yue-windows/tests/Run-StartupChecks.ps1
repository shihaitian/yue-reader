[CmdletBinding()]
param([string]$BuildDirectory = 'build', [int]$Runs = 3)
$ErrorActionPreference = 'Stop'
$native = Split-Path -Parent $PSScriptRoot
$build = (Resolve-Path -LiteralPath (Join-Path $native $BuildDirectory)).Path
$info = Get-Content -LiteralPath (Join-Path $build 'build-info.json') -Raw | ConvertFrom-Json
$runRoot = Join-Path $build ('startup-checks-' + [guid]::NewGuid().ToString('N'))
$harness = Join-Path $runRoot 'app'
New-Item -ItemType Directory -Path $harness -Force | Out-Null
Copy-Item -Path (Join-Path (Join-Path $build $info.appDirectory) '*') -Destination $harness -Recurse
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
foreach ($test in @('StartupBenchmark','StartupTests')) {
  $exe = Join-Path $harness ($test + '.exe')
  & $compiler /nologo /target:winexe /platform:x64 /optimize+ ("/main:$test") ("/out:$exe") /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll ('/r:'+(Join-Path $harness 'Microsoft.Web.WebView2.Core.dll')) ('/r:'+(Join-Path $harness 'Microsoft.Web.WebView2.WinForms.dll')) (Join-Path $native 'src/Common.cs') (Join-Path $native 'src/Localization.cs') (Join-Path $native 'src/Translations.cs') (Join-Path $native 'src/Program.cs') (Join-Path $PSScriptRoot ($test + '.cs'))
  if ($LASTEXITCODE -ne 0) { throw "$test compilation failed." }
  Copy-Item -LiteralPath (Join-Path $harness 'YueReader.exe.config') -Destination ($exe + '.config')
}
$matrix = Join-Path $runRoot 'compatibility'
$process = Start-Process -FilePath (Join-Path $harness 'StartupTests.exe') -ArgumentList ('"'+$matrix+'"') -WindowStyle Hidden -Wait -PassThru
Get-Content -LiteralPath (Join-Path $matrix 'startup-result.txt')
if ($process.ExitCode -ne 0) { throw 'Native first-frame/theme/language checks failed.' }
$measurements = @()
foreach ($round in 1..$Runs) {
  $data = Join-Path $runRoot ("fresh-$round")
  $process = Start-Process -FilePath (Join-Path $harness 'StartupBenchmark.exe') -ArgumentList ('"'+$data+'"') -WindowStyle Hidden -Wait -PassThru
  $measurement = Get-Content -LiteralPath (Join-Path $data 'benchmark.json') -Raw | ConvertFrom-Json
  if ($process.ExitCode -ne 0) { throw ($measurement | ConvertTo-Json) }
  $measurements += $measurement
}
# Restart with an existing profile, including the document saved by the last run.
$process = Start-Process -FilePath (Join-Path $harness 'StartupBenchmark.exe') -ArgumentList ('"'+$data+'"') -WindowStyle Hidden -Wait -PassThru
$warm = Get-Content -LiteralPath (Join-Path $data 'benchmark.json') -Raw | ConvertFrom-Json
if ($process.ExitCode -ne 0) { throw ($warm | ConvertTo-Json) }
$report = @{ version=$info.version; freshProfiles=$measurements; existingProfile=$warm; note='Main-to-document-ready on this machine. Transparent non-activating windows, isolated profiles; no install or registry changes. Reopen includes the named-pipe forwarding path.' }
[IO.File]::WriteAllText((Join-Path $runRoot 'report.json'), ($report | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
$measurements | Select-Object engineReadyMs,domReadyMs,documentVisibleMs,nextDocumentMs
Write-Output ('Existing profile: ' + $warm.documentVisibleMs + ' ms; next document: ' + $warm.nextDocumentMs + ' ms.')
Write-Output "Saved startup report: $runRoot/report.json"
