# yaml-language-server: $schema=https://aka.ms/winget-manifest.installer.1.6.0.schema.json
PackageIdentifier: LLGGJ.Venix
PackageVersion: @VERSION@
InstallerType: zip
NestedInstallerType: portable
NestedInstallerFiles:
  - RelativeFilePath: venix.exe
    PortableCommandAlias: venix
Installers:
  - Architecture: x64
    InstallerUrl: https://github.com/LLGGJ/venix-cli/releases/download/v@VERSION@/venix_@VERSION@_windows_amd64.zip
    InstallerSha256: @SHA256_windows_amd64_UPPER@
  - Architecture: arm64
    InstallerUrl: https://github.com/LLGGJ/venix-cli/releases/download/v@VERSION@/venix_@VERSION@_windows_arm64.zip
    InstallerSha256: @SHA256_windows_arm64_UPPER@
ManifestType: installer
ManifestVersion: 1.6.0
