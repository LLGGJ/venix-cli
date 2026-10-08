{
  "version": "@VERSION@",
  "description": "CLI da VenixCloud",
  "homepage": "https://venixcloud.com",
  "license": "@LICENSE@",
  "architecture": {
    "64bit": {
      "url": "https://github.com/LLGGJ/venix-cli/releases/download/v@VERSION@/venix_@VERSION@_windows_amd64.zip",
      "hash": "@SHA256_windows_amd64@"
    },
    "arm64": {
      "url": "https://github.com/LLGGJ/venix-cli/releases/download/v@VERSION@/venix_@VERSION@_windows_arm64.zip",
      "hash": "@SHA256_windows_arm64@"
    }
  },
  "bin": "venix.exe",
  "checkver": {
    "github": "https://github.com/LLGGJ/venix-cli"
  },
  "autoupdate": {
    "architecture": {
      "64bit": {
        "url": "https://github.com/LLGGJ/venix-cli/releases/download/v$version/venix_$version_windows_amd64.zip"
      },
      "arm64": {
        "url": "https://github.com/LLGGJ/venix-cli/releases/download/v$version/venix_$version_windows_arm64.zip"
      }
    },
    "hash": {
      "url": "$baseurl/SHA256SUMS"
    }
  }
}
