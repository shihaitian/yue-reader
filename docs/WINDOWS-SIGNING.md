# Windows EXE signing

## Status

The public **1.2.1 preview is unsigned**. The build now supports signing with a certificate-store identity, plus separate stages for a cloud signing service. No signing certificate or service has been provisioned for Yue, and no trusted Yue signature has been produced or verified yet. Keep download pages and release notes accurate until a signed release passes the full procedure below.

官网下载 EXE 的方式保持不变。签名流程已准备好，但还需完成发布者认证并获得可用的签名证书／服务。当前 1.2.1 仍是未签名预览版。请勿把自签证书、删除下载标记或关闭 SmartScreen 当作面向用户的签名方案。

## Choose an identity first

- An existing publicly trusted code-signing certificate backed by its hardware token or signing provider can use the local certificate-store flow below. Install the CA's supported key provider. The private key stays in that provider; the scripts do not import or export private keys and do not accept a password.
- Microsoft **Azure Artifact Signing Public Trust** can be connected between the build stages. Eligibility depends on the legal identity and country/region; individual validation currently supports the US and Canada. Confirm [current eligibility](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart) before creating a billed resource. Prefer OIDC for GitHub authentication and scope the signing role to the certificate profile. An Azure signing workflow is not enabled in this repository.
- **SignPath Foundation** is a possible application route for qualifying open-source projects, subject to review, project reputation and its [terms](https://signpath.org/terms). Acceptance is not guaranteed. Its certificate identifies SignPath Foundation, and releases require manual approval. The WebView2 dependency and project eligibility must be reviewed with the service. No application or signing policy has been approved for Yue.

Confirm whether the publisher is an individual or organization, its legal country/region, and any existing certificate/service. Identity documents and billing belong in the provider's own portal. Never commit or paste private keys, passwords or identity documents into an issue, workflow or chat.

## Local signing with a trusted certificate

Requirements: Windows, .NET Framework 4.8, Node.js 24, the Windows SDK SignTool, and an approved publicly trusted code-signing identity available in `CurrentUser\My` or `LocalMachine\My`. The expected publisher is the **complete certificate Subject**, not an arbitrary app display name. Read its public metadata in the certificate manager or with `Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert`.

After obtaining the WebView2 SDK as described in the README, run from `yue-windows`. The placeholders below must be replaced with the actual certificate metadata and the CA's RFC 3161 timestamp endpoint:

```powershell
./release.ps1 `
  -CertificateThumbprint '<certificate thumbprint>' `
  -ExpectedPublisher '<exact certificate Subject>' `
  -TimestampUrl '<CA RFC 3161 URL>' `
  -Destination 'C:\releases\yue-signed-candidate'
```

The output directory must not already exist. Add `-CertificateStore LocalMachine` only when that is the store holding the signing identity. Hardware providers may request their own authentication. Signing uses SHA-256 for file and timestamp digests; the SHA-1 thumbprint is only the certificate identifier.

The script builds in a fresh subdirectory and:

1. Compiles and tests the app. Signs only YueReader.exe and Uninstall.exe; bundled Microsoft DLLs retain their upstream signatures.
2. Verifies the expected publisher, code-signing usage, embedded Windows-trusted signature and timestamp. SignTool warnings fail the release.
3. Embeds those signed bytes in the installer, then signs and verifies the installer.
4. Extracts the actual installer resource through `--verify-extract`, without installing or changing file associations. Compares its complete file list and contents with both the app tree and portable ZIP.
5. Exports the installer, portable ZIP, public certificate metadata in SIGNATURES.json, and SHA256SUMS.txt. Checksums are generated after signing.

The verifier uses the Windows trust store. Run releases on a maintained, trusted machine with normal public root certificates; do not add a private root to make an untrusted certificate pass. Self-signed leaf certificates are explicitly rejected. Do not rebuild or edit an executable after signing it.

## Cloud signing between stages

Provider-specific authentication is still required. A signing service must sign the exact two app files, then the exact installer file, with a public-trust certificate and SHA-256 RFC 3161 timestamping. Do not sign every DLL indiscriminately. Use the provider's official integration, such as the [Azure action](https://github.com/Azure/artifact-signing-action), after identity approval.

```powershell
./build.ps1 -Stage App -BuildDirectory build/cloud-candidate
# Provider signs build/cloud-candidate/app-<version>/YueReader.exe and Uninstall.exe here.
./build.ps1 -Stage Installer -BuildDirectory build/cloud-candidate `
  -RequireSignedPayload -ExpectedPublisher '<exact certificate Subject>'
# Provider signs build/cloud-candidate/Yue-Setup-<version>-x64.exe here.
./scripts/Export-SignedRelease.ps1 `
  -BuildDirectory build/cloud-candidate `
  -Destination 'C:\releases\yue-signed-candidate' `
  -ExpectedPublisher '<exact certificate Subject>'
```

Replace `<version>` with the version in build-info.json. Use a fresh candidate directory for every release. Restrict any future signing workflow to reviewed source, with protected environment approval and least-privilege credentials. Never expose signing credentials to pull-request code. The existing check workflow only builds unsigned development binaries and tests rejection paths.

## Publish and verify

Create a new version/tag for the signed release; do not silently replace the 1.2.1 preview or its checksums. Upload the exported bytes unchanged to GitHub Releases and the website download location. Download the resulting EXE through a normal browser, compare its SHA-256, inspect the certificate publisher in Windows Properties, and test install, update, opening `.md`, and uninstall on a clean Windows profile. Keep the Internet zone metadata during this test. Update the website's signing notice only after those checks pass.

A trusted signature establishes publisher identity and integrity. SmartScreen also considers download reputation, so **a valid signature does not guarantee the first download of a new EXE will have no warning**. EV signing no longer provides an automatic SmartScreen bypass. See [Microsoft's reputation guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation) and [SignTool documentation](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool).

## Validation limits

`./tests/SigningTests.ps1` checks unsigned/missing/tampered input, wrong publisher, missing signing identity, rejection before export, immutable release destinations, and path boundaries. Its positive trust check uses an existing timestamped Microsoft SDK binary, not a fabricated Yue signature. Tests do not import certificates, alter the trust store, install Yue or change Defender settings. End-to-end signing and clean-machine download reputation remain untested until a real signing identity is available.
