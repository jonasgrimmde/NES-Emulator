param(
  [ValidateSet("install", "update", "status", "uninstall", "help")]
  [string] $Action = "install"
)

$ErrorActionPreference = "Stop"

$AppName = "NES Emulator"
$Repo = "jonasgrimmde/NES-Emulator"
$ReleaseBase = "https://github.com/$Repo/releases/latest/download"
$RawBase = "https://raw.githubusercontent.com/$Repo/refs/heads/main"
$InstallerUrl = "$ReleaseBase/NES-Emulator-Windows-Setup.exe"
$ManifestUrl = "$ReleaseBase/latest.yml"
$InstallRoot = Join-Path $env:APPDATA "jonasgrimm.de\NES Emulator"
$ExePath = Join-Path $InstallRoot "NES Emulator.exe"
$RegistryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{A31C1B42-7440-4E41-8CB7-6326EC0C184F}_is1"

function Write-Line {
  Write-Host "----------------------------------------" -ForegroundColor DarkGray
}

function Write-Title {
  Write-Line
  Write-Host "$AppName Windows Installer" -ForegroundColor Cyan
  Write-Line
}

function Write-Step($Text) {
  Write-Host "> $Text" -ForegroundColor Blue
}

function Write-Ok($Text) {
  Write-Host "OK $Text" -ForegroundColor Green
}

function Write-Warn($Text) {
  Write-Host "WARN $Text" -ForegroundColor Yellow
}

function Write-Fail($Text) {
  Write-Host "ERROR $Text" -ForegroundColor Red
  exit 1
}

function Get-ManifestValue($Text, $Key) {
  $pattern = "(?m)^$([regex]::Escape($Key)):\s*(.+?)\s*$"
  $match = [regex]::Match($Text, $pattern)
  if (-not $match.Success) {
    return ""
  }
  return $match.Groups[1].Value.Trim().Trim('"')
}

function Convert-WebContentToText($Content) {
  if ($Content -is [byte[]]) {
    return [System.Text.Encoding]::UTF8.GetString($Content)
  }
  if ($null -eq $Content) {
    return ""
  }
  return [string] $Content
}

function Get-LatestManifest {
  Write-Step "Checking latest release..."
  $response = Invoke-WebRequest -UseBasicParsing -Uri $ManifestUrl
  return Convert-WebContentToText $response.Content
}

function Get-LatestVersion($Manifest) {
  $version = Get-ManifestValue $Manifest "version"
  if (-not $version) {
    Write-Fail "Could not read latest version from latest.yml."
  }
  return $version
}

function Get-InstalledInfo {
  if (Test-Path $RegistryPath) {
    $item = Get-ItemProperty $RegistryPath
    return [pscustomobject]@{
      Installed = $true
      Version = if ($item.DisplayVersion) { [string] $item.DisplayVersion } else { "unknown" }
      UninstallString = if ($item.QuietUninstallString) { [string] $item.QuietUninstallString } else { [string] $item.UninstallString }
      InstallLocation = if ($item.InstallLocation) { [string] $item.InstallLocation } else { $InstallRoot }
    }
  }

  return [pscustomobject]@{
    Installed = (Test-Path $ExePath)
    Version = "unknown"
    UninstallString = ""
    InstallLocation = $InstallRoot
  }
}

function Show-Paths {
  Write-Host ("{0,-12} {1}" -f "App", $ExePath) -ForegroundColor DarkGray
  Write-Host ("{0,-12} {1}" -f "App data", $InstallRoot) -ForegroundColor DarkGray
}

function Install-App {
  Write-Title
  $manifest = Get-LatestManifest
  $latestVersion = Get-LatestVersion $manifest
  $installed = Get-InstalledInfo

  Write-Host ("{0,-12} {1}" -f "Installed", $(if ($installed.Installed) { $installed.Version } else { "not installed" })) -ForegroundColor DarkGray
  Write-Host ("{0,-12} {1}" -f "Latest", $latestVersion) -ForegroundColor DarkGray

  if ($installed.Installed -and $installed.Version -eq $latestVersion) {
    Write-Ok "Already installed and up to date."
    Show-Paths
    return
  }

  $tempInstaller = Join-Path ([System.IO.Path]::GetTempPath()) "NES-Emulator-Windows-Setup.exe"
  Write-Step "Downloading installer..."
  Invoke-WebRequest -UseBasicParsing -Uri $InstallerUrl -OutFile $tempInstaller

  Write-Step "$(if ($installed.Installed) { "Updating" } else { "Installing" }) $AppName $latestVersion..."
  $installerArgs = @("/SILENT", "/NORESTART", "/FORCECLOSEAPPLICATIONS", "/SUPPRESSMSGBOXES")
  $process = Start-Process -FilePath $tempInstaller -ArgumentList $installerArgs -Wait -PassThru
  Remove-Item -LiteralPath $tempInstaller -Force -ErrorAction SilentlyContinue

  if ($process.ExitCode -ne 0) {
    Write-Fail "Installer failed with exit code $($process.ExitCode)."
  }

  Write-Ok "$AppName $latestVersion installed."
  Show-Paths
}

function Show-Status {
  Write-Title
  $installed = Get-InstalledInfo
  try {
    $manifest = Get-LatestManifest
    $latestVersion = Get-LatestVersion $manifest
  } catch {
    $latestVersion = "unknown"
    Write-Warn "Could not check latest release: $($_.Exception.Message)"
  }

  if ($installed.Installed) {
    Write-Ok "Installed"
  } else {
    Write-Warn "Not installed"
  }

  Write-Host ("{0,-12} {1}" -f "Installed", $(if ($installed.Installed) { $installed.Version } else { "not installed" })) -ForegroundColor DarkGray
  Write-Host ("{0,-12} {1}" -f "Latest", $latestVersion) -ForegroundColor DarkGray

  if ($installed.Installed -and $latestVersion -ne "unknown") {
    if ($installed.Version -eq $latestVersion) {
      Write-Ok "Up to date."
    } else {
      Write-Warn "Update available."
    }
  }

  Show-Paths
}

function Uninstall-App {
  Write-Title
  $installed = Get-InstalledInfo
  if (-not $installed.Installed) {
    Write-Warn "$AppName is not installed."
    return
  }

  $uninstall = $installed.UninstallString
  if (-not $uninstall) {
    Write-Fail "Could not find uninstall command."
  }

  if ($uninstall -match '^\s*"([^"]+)"\s*(.*)$') {
    $uninstaller = $matches[1]
    $existingArgs = $matches[2]
  } else {
    $parts = $uninstall.Split(" ", 2)
    $uninstaller = $parts[0]
    $existingArgs = if ($parts.Count -gt 1) { $parts[1] } else { "" }
  }

  Write-Step "Uninstalling $AppName..."
   $uninstallArgs = @()
  if ($existingArgs) {
    $uninstallArgs += $existingArgs
  }
  $uninstallArgs += "/SILENT"
  $uninstallArgs += "/NORESTART"
  $uninstallArgs += "/SUPPRESSMSGBOXES"

  $process = Start-Process -FilePath $uninstaller -ArgumentList $uninstallArgs -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    Write-Fail "Uninstaller failed with exit code $($process.ExitCode)."
  }

  Write-Ok "$AppName uninstalled."
  Write-Host "Your games, saves, and settings may remain at: $InstallRoot" -ForegroundColor DarkGray
}

function Show-Help {
  Write-Title
  Write-Host "Usage:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File install.ps1"
  Write-Host "  powershell -ExecutionPolicy Bypass -File install.ps1 status"
  Write-Host "  powershell -ExecutionPolicy Bypass -File install.ps1 uninstall"
  Write-Host ""
  Write-Host "Remote one-liners:"
  Write-Host "  iwr -useb $RawBase/install.ps1 | iex"
  Write-Host "  iex `"& { `$(iwr -useb $RawBase/install.ps1) } status`""
  Write-Host "  iex `"& { `$(iwr -useb $RawBase/install.ps1) } uninstall`""
}

switch ($Action) {
  "install" { Install-App }
  "update" { Install-App }
  "status" { Show-Status }
  "uninstall" { Uninstall-App }
  "help" { Show-Help }
}
