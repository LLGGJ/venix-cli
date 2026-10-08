class Venix < Formula
  desc "CLI da VenixCloud"
  homepage "https://venixcloud.com"
  version "@VERSION@"
  license "@LICENSE@"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/LLGGJ/venix-cli/releases/download/v@VERSION@/venix_@VERSION@_darwin_arm64.tar.gz"
      sha256 "@SHA256_darwin_arm64@"
    else
      url "https://github.com/LLGGJ/venix-cli/releases/download/v@VERSION@/venix_@VERSION@_darwin_amd64.tar.gz"
      sha256 "@SHA256_darwin_amd64@"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/LLGGJ/venix-cli/releases/download/v@VERSION@/venix_@VERSION@_linux_arm64.tar.gz"
      sha256 "@SHA256_linux_arm64@"
    else
      url "https://github.com/LLGGJ/venix-cli/releases/download/v@VERSION@/venix_@VERSION@_linux_amd64.tar.gz"
      sha256 "@SHA256_linux_amd64@"
    end
  end

  def install
    bin.install "venix"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/venix --version")
  end
end
