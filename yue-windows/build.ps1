$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
function Compile([string[]]$CompilerArguments) {
  & $compiler @CompilerArguments
  if ($LASTEXITCODE -ne 0) { throw 'C# compilation failed.' }
}
$version = '1.2.0'
$appOutput = "build\app-$version"
New-Item -ItemType Directory -Force -Path 'build',$appOutput | Out-Null
# A shared web source supplies both distributions. Source archives include its snapshot.
if (Test-Path -LiteralPath '..\md-reader\dist\highlights.js') {
  Copy-Item -Path '..\md-reader\dist\*' -Destination 'app\ui' -Recurse -Force
}
Copy-Item -LiteralPath 'app\ui','app\YueReader.exe.config','app\LICENSE.txt','app\THIRD-PARTY-NOTICES.txt' -Destination $appOutput -Recurse -Force
Compile @('/nologo','/target:exe','/out:build\MakeIcon.exe','/r:System.Drawing.dll','src\MakeIcon.cs')
& '.\build\MakeIcon.exe' 'build\yue.ico'
Copy-Item -LiteralPath 'vendor\webview2\lib\net462\Microsoft.Web.WebView2.Core.dll','vendor\webview2\lib\net462\Microsoft.Web.WebView2.WinForms.dll','vendor\webview2\runtimes\win-x64\native\WebView2Loader.dll' -Destination $appOutput
Copy-Item -LiteralPath 'vendor\webview2\LICENSE.txt' -Destination "$appOutput\WebView2-LICENSE.txt"
Copy-Item -LiteralPath 'vendor\webview2\NOTICE.txt' -Destination "$appOutput\WebView2-NOTICE.txt"
Compile @('/nologo','/target:winexe','/platform:x64','/optimize+','/win32manifest:app.manifest','/win32icon:build\yue.ico',"/out:$appOutput\YueReader.exe",'/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Web.Extensions.dll',"/r:$appOutput\Microsoft.Web.WebView2.Core.dll","/r:$appOutput\Microsoft.Web.WebView2.WinForms.dll",'src\Common.cs','src\Localization.cs','src\Translations.cs','src\Program.cs')
Compile @('/nologo','/target:winexe','/platform:x64','/optimize+','/win32manifest:app.manifest','/win32icon:build\yue.ico',"/out:$appOutput\Uninstall.exe",'/r:System.Windows.Forms.dll','src\Common.cs','src\Localization.cs','src\Translations.cs','src\Uninstall.cs')
Compile @('/nologo','/target:exe','/platform:x64','/out:build\Tests.exe','src\Common.cs','src\Localization.cs','src\Translations.cs','src\Tests.cs')
& '.\build\Tests.exe' (Join-Path $PSScriptRoot 'build\tests')
if ($LASTEXITCODE -ne 0) { throw 'Native tests failed.' }
node --check "$appOutput/ui/app.js"
if ($LASTEXITCODE -ne 0) { throw 'JavaScript check failed.' }
node --check "$appOutput/ui/highlights.js"
if ($LASTEXITCODE -ne 0) { throw 'Highlight module check failed.' }
$appRoot = (Resolve-Path -LiteralPath $appOutput).Path
$files = Get-ChildItem -LiteralPath $appRoot -File -Recurse | ForEach-Object { $_.FullName.Substring($appRoot.Length + 1) }
$files = @($files | Where-Object { $_ -ne 'installed-files.txt' }) + 'installed-files.txt'
[IO.File]::WriteAllLines((Join-Path $appRoot 'installed-files.txt'), $files, [Text.UTF8Encoding]::new($false))
Compress-Archive -Path "$appOutput\*" -DestinationPath 'build\payload.zip' -Force
Compile @('/nologo','/target:winexe','/platform:x64','/optimize+','/win32manifest:app.manifest','/win32icon:build\yue.ico',"/out:build\Yue-Setup-$version-x64.exe",'/resource:build\payload.zip,Yue.Payload','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.IO.Compression.dll','/r:System.IO.Compression.FileSystem.dll','src\Common.cs','src\Localization.cs','src\Translations.cs','src\Setup.cs')
Get-Item -LiteralPath "$appOutput\YueReader.exe","build\Yue-Setup-$version-x64.exe" | Select-Object Name,Length
