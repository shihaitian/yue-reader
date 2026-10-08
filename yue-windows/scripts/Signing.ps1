# Shared by local certificate-store signing, cloud signing integrations, and release gates.
function Get-YueSignTool {
  $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  $sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
  $versions = Get-ChildItem -LiteralPath $sdk -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } |
    Sort-Object { [version]$_.Name } -Descending
  foreach ($directory in $versions) {
    $candidate = Join-Path $directory.FullName 'x64/signtool.exe'
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }
  throw 'Install the Windows SDK signing tools, or add signtool.exe to PATH.'
}

function Assert-YueSignature {
  param(
    [Parameter(Mandatory=$true)][string[]]$Paths,
    [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$ExpectedPublisher
  )
  if ([string]::IsNullOrWhiteSpace($ExpectedPublisher)) { throw 'ExpectedPublisher must be the exact certificate Subject.' }
  foreach ($file in $Paths) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Signature input is missing: $file" }
    $path = (Resolve-Path -LiteralPath $file -ErrorAction Stop).Path
    $signature = Get-AuthenticodeSignature -LiteralPath $path
    if ($signature.Status -ne 'Valid' -or $signature.SignatureType -ne 'Authenticode') {
      throw "Trusted embedded Authenticode signature required: $path ($($signature.Status))."
    }
    $certificate = $signature.SignerCertificate
    if ($certificate.Subject -ne $ExpectedPublisher) { throw "Unexpected publisher on $path. Expected the configured certificate Subject." }
    if ($certificate.Subject -eq $certificate.Issuer) { throw "Self-signed certificates are not accepted: $path" }
    $eku = @($certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' } | ForEach-Object { $_.EnhancedKeyUsages } | ForEach-Object { $_.Value })
    if ($eku -notcontains '1.3.6.1.5.5.7.3.3') { throw "Code signing certificate required: $path" }
    if (-not $signature.TimeStamperCertificate) { throw "A trusted timestamp is required: $path" }
    $signTool = Get-YueSignTool
    $verification = & $signTool verify /pa /all /tw $path 2>&1
    if ($LASTEXITCODE -ne 0) { throw "SignTool verification failed for $path`n$($verification -join [Environment]::NewLine)" }
    [pscustomobject]@{
      file = [IO.Path]::GetFileName($path)
      sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
      publisher = $certificate.Subject
      certificateThumbprint = $certificate.Thumbprint
      timestampAuthority = $signature.TimeStamperCertificate.Subject
    }
  }
}

function Invoke-YueSign {
  param(
    [Parameter(Mandatory=$true)][string[]]$Paths,
    [Parameter(Mandatory=$true)][string]$CertificateThumbprint,
    [Parameter(Mandatory=$true)][string]$ExpectedPublisher,
    [Parameter(Mandatory=$true)][uri]$TimestampUrl,
    [ValidateSet('CurrentUser','LocalMachine')][string]$CertificateStore = 'CurrentUser'
  )
  $thumbprint = $CertificateThumbprint -replace '\s',''
  if ($thumbprint -notmatch '^[a-fA-F0-9]{40}$') { throw 'Specify the SHA-1 thumbprint identifying the signing certificate.' }
  if ($TimestampUrl.Scheme -notin @('http','https') -or -not $TimestampUrl.IsAbsoluteUri) { throw 'Specify the CA-provided RFC 3161 timestamp URL.' }
  $certificatePath = "Cert:\$CertificateStore\My\$thumbprint"
  if (-not (Test-Path -LiteralPath $certificatePath)) { throw 'Signing certificate was not found in the selected certificate store.' }
  $certificate = Get-Item -LiteralPath $certificatePath -ErrorAction Stop
  if ($certificate.Subject -ne $ExpectedPublisher -or -not $certificate.HasPrivateKey) { throw 'The expected signing identity and accessible private key are required.' }
  if ($certificate.Subject -eq $certificate.Issuer) { throw 'A self-signed certificate cannot be used for public releases.' }
  if ($certificate.NotBefore -gt (Get-Date) -or $certificate.NotAfter -le (Get-Date)) { throw 'The signing certificate is not currently valid.' }
  $eku = @($certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' } | ForEach-Object { $_.EnhancedKeyUsages } | ForEach-Object { $_.Value })
  if ($eku -notcontains '1.3.6.1.5.5.7.3.3') { throw 'The certificate must have the Code Signing extended key usage.' }
  $chain = New-Object Security.Cryptography.X509Certificates.X509Chain
  try {
    $chain.ChainPolicy.RevocationMode = 'Online'
    if (-not $chain.Build($certificate)) { throw 'The signing certificate chain could not be validated.' }
  } finally { $chain.Dispose() }
  $signTool = Get-YueSignTool
  foreach ($file in $Paths) {
    $path = (Resolve-Path -LiteralPath $file -ErrorAction Stop).Path
    $signArguments = @('sign','/s','My','/sha1',$thumbprint,'/fd','SHA256','/tr',$TimestampUrl.AbsoluteUri,'/td','SHA256','/d','Yue Markdown Reader','/du','https://github.com/shihaitian/yue-reader')
    if ($CertificateStore -eq 'LocalMachine') { $signArguments += '/sm' }
    & $signTool @signArguments $path | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Signing or timestamping failed: $path" }
    Assert-YueSignature -Paths @($path) -ExpectedPublisher $ExpectedPublisher | Out-Null
  }
}
