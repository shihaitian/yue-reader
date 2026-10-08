[CmdletBinding()]
param(
  [ValidateSet('All','App','Installer')][string]$Stage = 'All',
  [string]$BuildDirectory = 'build',
  [switch]$RequireSignedPayload,
  [string]$ExpectedPublisher
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
. (Join-Path $PSScriptRoot 'scripts/Signing.ps1')
$buildRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot $BuildDirectory))
$allowedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'build'))
if ($buildRoot -ne $allowedRoot -and -not $buildRoot.StartsWith($allowedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'BuildDirectory must be build or a directory inside build.'
}
$ancestor = $buildRoot
while ($ancestor -ne $PSScriptRoot) {
  if ((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Build output must not pass through a link.' }
  $ancestor = Split-Path -Parent $ancestor
}
if ($RequireSignedPayload -and ($Stage -ne 'Installer' -or [string]::IsNullOrWhiteSpace($ExpectedPublisher))) {
  throw 'Use -Stage Installer -RequireSignedPayload -ExpectedPublisher after signing the App stage.'
}
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
function Compile([string[]]$CompilerArguments) {
  & $compiler @CompilerArguments
  if ($LASTEXITCODE -ne 0) { throw 'C# compilation failed.' }
}
$version = '1.2.1'
$appOutput = Join-Path $buildRoot "app-$version"
$icon = Join-Path $buildRoot 'yue.ico'
$payload = Join-Path $buildRoot 'payload.zip'
$setup = Join-Path $buildRoot "Yue-Setup-$version-x64.exe"
$buildInfo = Join-Path $buildRoot 'build-info.json'
if ($Stage -ne 'Installer') {
New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
foreach ($staleFile in @($payload,$setup,$buildInfo)) {
  if (Test-Path -LiteralPath $staleFile) { Remove-Item -LiteralPath $staleFile -Force }
}
# Remove only our resolved build subdirectory, so stale files cannot enter a payload.
if (Test-Path -LiteralPath $appOutput) {
  $resolvedApp = (Resolve-Path -LiteralPath $appOutput).Path
  if (-not $resolvedApp.StartsWith($buildRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe app output path.' }
  if ((Get-Item -LiteralPath $appOutput).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'App output must not be a link.' }
  Remove-Item -LiteralPath $resolvedApp -Recurse -Force
}
New-Item -ItemType Directory -Path $appOutput | Out-Null
# A shared web source supplies both distributions. Source archives include its snapshot.
if (Test-Path -LiteralPath '..\md-reader\dist\highlights.js') {
  Copy-Item -Path '..\md-reader\dist\*' -Destination 'app\ui' -Recurse -Force
}
Copy-Item -LiteralPath 'app\ui','app\YueReader.exe.config','app\LICENSE.txt','app\THIRD-PARTY-NOTICES.txt' -Destination $appOutput -Recurse -Force
$makeIcon = Join-Path $buildRoot 'MakeIcon.exe'
Compile @('/nologo','/target:exe',"/out:$makeIcon",'/r:System.Drawing.dll','src\MakeIcon.cs')
& $makeIcon $icon
if ($LASTEXITCODE -ne 0) { throw 'Icon generation failed.' }
Copy-Item -LiteralPath 'vendor\webview2\lib\net462\Microsoft.Web.WebView2.Core.dll','vendor\webview2\lib\net462\Microsoft.Web.WebView2.WinForms.dll','vendor\webview2\runtimes\win-x64\native\WebView2Loader.dll' -Destination $appOutput
Copy-Item -LiteralPath 'vendor\webview2\LICENSE.txt' -Destination "$appOutput\WebView2-LICENSE.txt"
Copy-Item -LiteralPath 'vendor\webview2\NOTICE.txt' -Destination "$appOutput\WebView2-NOTICE.txt"
Compile @('/nologo','/target:winexe','/platform:x64','/optimize+','/win32manifest:app.manifest',"/win32icon:$icon","/out:$appOutput\YueReader.exe",'/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Web.Extensions.dll',"/r:$appOutput\Microsoft.Web.WebView2.Core.dll","/r:$appOutput\Microsoft.Web.WebView2.WinForms.dll",'src\Common.cs','src\Localization.cs','src\Translations.cs','src\Program.cs')
Compile @('/nologo','/target:winexe','/platform:x64','/optimize+','/win32manifest:app.manifest',"/win32icon:$icon","/out:$appOutput\Uninstall.exe",'/r:System.Windows.Forms.dll','src\Common.cs','src\Localization.cs','src\Translations.cs','src\Uninstall.cs')
$tests = Join-Path $buildRoot 'Tests.exe'
Compile @('/nologo','/target:exe','/platform:x64',"/out:$tests",'src\Common.cs','src\Localization.cs','src\Translations.cs','src\Tests.cs')
& $tests (Join-Path $buildRoot 'tests')
if ($LASTEXITCODE -ne 0) { throw 'Native tests failed.' }
node --check "$appOutput/ui/app.js"
if ($LASTEXITCODE -ne 0) { throw 'JavaScript check failed.' }
node --check "$appOutput/ui/highlights.js"
if ($LASTEXITCODE -ne 0) { throw 'Highlight module check failed.' }
[IO.File]::WriteAllText($buildInfo, (@{ version=$version; appDirectory="app-$version"; installer="Yue-Setup-$version-x64.exe" } | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
}
if ($Stage -eq 'App') {
  Write-Output "App stage ready at $appOutput. Sign YueReader.exe and Uninstall.exe before building a release installer."
  return
}
if (-not (Test-Path -LiteralPath $buildInfo)) { throw 'Run the App stage first.' }
$info = Get-Content -LiteralPath $buildInfo -Raw | ConvertFrom-Json
if ($info.version -ne $version) { throw 'App stage version does not match the installer source.' }
$appExecutables = @((Join-Path $appOutput 'YueReader.exe'), (Join-Path $appOutput 'Uninstall.exe'))
foreach ($file in $appExecutables) {
  if ([Diagnostics.FileVersionInfo]::GetVersionInfo($file).FileVersion -ne "$version.0") { throw "Version mismatch: $file" }
}
if ($RequireSignedPayload) {
  Assert-YueSignature -Paths $appExecutables -ExpectedPublisher $ExpectedPublisher | Out-Null
} else {
  Write-Warning 'Development build: signatures are not required. Use release.ps1 for public signed downloads.'
}
$appRoot = (Resolve-Path -LiteralPath $appOutput).Path
$files = Get-ChildItem -LiteralPath $appRoot -File -Recurse | ForEach-Object { $_.FullName.Substring($appRoot.Length + 1) }
$files = @($files | Where-Object { $_ -ne 'installed-files.txt' }) + 'installed-files.txt'
[IO.File]::WriteAllLines((Join-Path $appRoot 'installed-files.txt'), $files, [Text.UTF8Encoding]::new($false))
Compress-Archive -Path "$appOutput\*" -DestinationPath $payload -Force
Compile @('/nologo','/target:winexe','/platform:x64','/optimize+','/win32manifest:app.manifest',"/win32icon:$icon","/out:$setup","/resource:$payload,Yue.Payload",'/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.IO.Compression.dll','/r:System.IO.Compression.FileSystem.dll','src\Common.cs','src\Localization.cs','src\Translations.cs','src\Setup.cs')
Get-Item -LiteralPath "$appOutput\YueReader.exe",$setup | Select-Object Name,Length
