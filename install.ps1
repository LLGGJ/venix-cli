# Instalador da Venix CLI para Windows (PowerShell). Não depende do npm.
#
#   irm https://raw.githubusercontent.com/LLGGJ/venix-cli/main/install.ps1 | iex
#
# Variáveis opcionais: VENIX_VERSION, VENIX_INSTALL_DIR, VENIX_RELEASE_BASE_URL
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$repo = 'LLGGJ/venix-cli'

$arch = switch ($env:PROCESSOR_ARCHITECTURE) {
  'AMD64' { 'amd64' }
  'ARM64' { 'arm64' }
  default { throw "Arquitetura não suportada: $($env:PROCESSOR_ARCHITECTURE)" }
}

$version = $env:VENIX_VERSION
if (-not $version) {
  $release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
  $version = $release.tag_name
}
$version = $version.TrimStart('v')

$base = if ($env:VENIX_RELEASE_BASE_URL) { $env:VENIX_RELEASE_BASE_URL.TrimEnd('/') } else { "https://github.com/$repo/releases/download/v$version" }
$archive = "venix_${version}_windows_${arch}.zip"
$dest = if ($env:VENIX_INSTALL_DIR) { $env:VENIX_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\venix' }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("venix-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  Write-Host "Venix CLI $version (windows_$arch)"
  Write-Host "Baixando $archive..."
  $zip = Join-Path $tmp $archive
  $sums = Join-Path $tmp 'SHA256SUMS'
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$archive" -OutFile $zip
  Invoke-WebRequest -UseBasicParsing -Uri "$base/SHA256SUMS" -OutFile $sums

  $line = Get-Content $sums | Where-Object { ($_ -split '\s+')[1] -replace '^\*', '' -eq $archive } | Select-Object -First 1
  if (-not $line) { throw "$archive não consta em SHA256SUMS" }
  $expected = ($line -split '\s+')[0].ToLower()
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLower()
  if ($expected -ne $actual) { throw "SHA-256 inválido para $archive" }
  Write-Host "🪟 Windows detectado ($arch)"

  $extract = Join-Path $tmp 'x'
  Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $extract 'venix.exe') -Destination (Join-Path $dest 'venix.exe') -Force

  $out = (& (Join-Path $dest 'venix.exe') --version).Trim()
  if ($out -ne $version) { throw "O binário instalado informa '$out', esperado '$version'" }

  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (($userPath -split ';') -notcontains $dest) {
    [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $dest), 'User')
    Write-Host "Adicionado ao PATH do usuário. Abra um novo terminal para usar 'venix'."
  }
  Write-Host "Instalado em $dest\venix.exe"
  Write-Host "Pronto! Rode: venix help"
} finally {
  Remove-Item -Recurse -Force -LiteralPath $tmp -ErrorAction SilentlyContinue
}
