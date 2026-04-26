[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$SkipNpmInstall,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
$MinimumNodeMajor = 18
$MinimumPythonMajor = 3
$MinimumPythonMinor = 8
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$Failures = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]

function Write-Section {
  param([string]$Text)
  Write-Host ""
  Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Text)
  Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Missing {
  param([string]$Text)
  Write-Host "[MISSING] $Text" -ForegroundColor Yellow
}

function Write-Fail {
  param([string]$Text)
  Write-Host "[FAIL] $Text" -ForegroundColor Red
  $Failures.Add($Text) | Out-Null
}

function Get-CommandPath {
  param([string]$Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Get-VersionParts {
  param([string]$Text)
  $match = [regex]::Match($Text, "(\d+)\.(\d+)\.(\d+)")
  if (-not $match.Success) { return $null }
  return [pscustomobject]@{
    Major = [int]$match.Groups[1].Value
    Minor = [int]$match.Groups[2].Value
    Patch = [int]$match.Groups[3].Value
    Raw = $match.Groups[0].Value
  }
}

function Test-MinVersion {
  param(
    [object]$Version,
    [int]$Major,
    [int]$Minor = 0
  )
  if (-not $Version) { return $false }
  if ($Version.Major -gt $Major) { return $true }
  if ($Version.Major -eq $Major -and $Version.Minor -ge $Minor) { return $true }
  return $false
}

function Invoke-Checked {
  param([string]$FilePath, [string[]]$Arguments)
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $FilePath @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "$FilePath $($Arguments -join ' ') failed: $output"
    }
    return ($output -join "`n").Trim()
  } finally {
    $ErrorActionPreference = $previousPreference
  }
}

function Get-WindowsInstaller {
  if (Get-CommandPath "winget") { return "winget" }
  if (Get-CommandPath "choco") { return "choco" }
  if (Get-CommandPath "scoop") { return "scoop" }
  return $null
}

function Confirm-Install {
  param([string]$Tool)
  if ($Yes) { return $true }
  $answer = Read-Host "Install $Tool now? Type y to continue"
  return $answer -match "^(y|yes)$"
}

function Install-WithWindowsManager {
  param(
    [string]$Tool,
    [string]$WingetId,
    [string]$ChocoId,
    [string]$ScoopId
  )
  if (-not $Install) {
    Write-Missing "$Tool is not installed. Re-run with -Install to install it."
    return
  }
  if (-not (Confirm-Install $Tool)) {
    Write-Missing "$Tool installation skipped."
    return
  }
  $manager = Get-WindowsInstaller
  if (-not $manager) {
    Write-Fail "No supported Windows package manager found for $Tool. Install winget, Chocolatey, or Scoop first."
    return
  }
  Write-Host "Installing $Tool with $manager..." -ForegroundColor Cyan
  if ($manager -eq "winget") {
    & winget install --id $WingetId --exact --source winget --accept-source-agreements --accept-package-agreements
  } elseif ($manager -eq "choco") {
    & choco install $ChocoId -y
  } else {
    & scoop install $ScoopId
  }
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "$Tool install command failed."
  } else {
    Write-Ok "$Tool installer completed. Open a new terminal if the command is not immediately available."
  }
}

function Ensure-Git {
  Write-Section "Git"
  $path = Get-CommandPath "git"
  if ($path) {
    $version = Invoke-Checked "git" @("--version")
    Write-Ok "$version ($path)"
  } else {
    Install-WithWindowsManager "Git" "Git.Git" "git" "git"
  }
}

function Ensure-Node {
  Write-Section "Node.js"
  $path = Get-CommandPath "node"
  if ($path) {
    $raw = Invoke-Checked "node" @("--version")
    $version = Get-VersionParts $raw
    if (Test-MinVersion $version $MinimumNodeMajor 0) {
      Write-Ok "Node.js $raw ($path)"
    } else {
      Write-Fail "Node.js $raw found, but SansqritPy requires Node.js >= $MinimumNodeMajor."
    }
  } else {
    Install-WithWindowsManager "Node.js LTS" "OpenJS.NodeJS.LTS" "nodejs-lts" "nodejs-lts"
  }

  $npmPath = Get-CommandPath "npm"
  if ($npmPath) {
    $npmVersion = Invoke-Checked "npm" @("--version")
    Write-Ok "npm $npmVersion ($npmPath)"
  } else {
    Write-Fail "npm was not found. It is normally installed with Node.js."
  }
}

function Ensure-Python {
  Write-Section "Python"
  $pythonCommand = $null
  foreach ($candidate in @("python", "py", "python3")) {
    if (Get-CommandPath $candidate) {
      try {
        $raw = if ($candidate -eq "py") { Invoke-Checked "py" @("-3", "--version") } else { Invoke-Checked $candidate @("--version") }
        $version = Get-VersionParts $raw
        if (Test-MinVersion $version $MinimumPythonMajor $MinimumPythonMinor) {
          $pythonCommand = $candidate
          Write-Ok "$raw ($candidate)"
          break
        }
      } catch {
        $Warnings.Add("Could not read Python version through ${candidate}: $_") | Out-Null
      }
    }
  }
  if (-not $pythonCommand) {
    Install-WithWindowsManager "Python $MinimumPythonMajor.$MinimumPythonMinor+" "Python.Python.3.12" "python" "python"
  }
  return $pythonCommand
}

function Ensure-Rust {
  Write-Section "Rust"
  $rustupPath = Get-CommandPath "rustup"
  if (-not $rustupPath) {
    Install-WithWindowsManager "Rust toolchain" "Rustlang.Rustup" "rustup.install" "rustup"
  } else {
    $rustupVersion = Invoke-Checked "rustup" @("--version")
    Write-Ok "$rustupVersion ($rustupPath)"
  }

  if (Get-CommandPath "rustc") {
    $rustcVersion = Invoke-Checked "rustc" @("--version")
    Write-Ok "$rustcVersion"
  } else {
    Write-Missing "rustc is not available yet."
  }

  if (Get-CommandPath "cargo") {
    $cargoVersion = Invoke-Checked "cargo" @("--version")
    Write-Ok "$cargoVersion"
  } else {
    Write-Missing "cargo is not available yet."
  }

  if (Get-CommandPath "rustup") {
    $targets = Invoke-Checked "rustup" @("target", "list", "--installed")
    if ($targets -match "wasm32-unknown-unknown") {
      Write-Ok "Rust target wasm32-unknown-unknown installed"
    } elseif ($Install) {
      Write-Host "Installing Rust target wasm32-unknown-unknown..." -ForegroundColor Cyan
      & rustup target add wasm32-unknown-unknown
      if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to install wasm32-unknown-unknown." } else { Write-Ok "Installed wasm32-unknown-unknown" }
    } else {
      Write-Missing "Rust target wasm32-unknown-unknown is missing. Re-run with -Install to add it."
    }
  }
}

function Ensure-WasmPack {
  Write-Section "wasm-pack"
  $path = Get-CommandPath "wasm-pack"
  if ($path) {
    $version = Invoke-Checked "wasm-pack" @("--version")
    Write-Ok "$version ($path)"
  } elseif ($Install -and (Get-CommandPath "cargo")) {
    if (Confirm-Install "wasm-pack") {
      Write-Host "Installing wasm-pack with cargo..." -ForegroundColor Cyan
      & cargo install wasm-pack
      if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to install wasm-pack." } else { Write-Ok "Installed wasm-pack" }
    } else {
      Write-Missing "wasm-pack installation skipped."
    }
  } else {
    Write-Missing "wasm-pack is missing. Re-run with -Install after Rust/Cargo are available."
  }
}

function Ensure-NodeDependencies {
  Write-Section "Project npm dependencies"
  if ($SkipNpmInstall) {
    Write-Host "Skipped npm dependency install because -SkipNpmInstall was provided." -ForegroundColor Yellow
    return
  }
  $packageJson = Join-Path $ProjectRoot "package.json"
  if (-not (Test-Path $packageJson)) {
    Write-Host "No package.json found at $ProjectRoot" -ForegroundColor Yellow
    return
  }
  $nodeModules = Join-Path $ProjectRoot "node_modules"
  if (Test-Path $nodeModules) {
    Write-Ok "node_modules exists"
    return
  }
  if (-not $Install) {
    Write-Missing "node_modules is missing. Re-run with -Install to run npm install."
    return
  }
  if (-not (Get-CommandPath "npm")) {
    Write-Fail "Cannot install npm dependencies because npm is missing."
    return
  }
  Push-Location $ProjectRoot
  try {
    if (Test-Path (Join-Path $ProjectRoot "package-lock.json")) {
      & npm ci
    } else {
      & npm install
    }
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm dependency install failed." } else { Write-Ok "npm dependencies installed" }
  } finally {
    Pop-Location
  }
}

Write-Host "SansqritPy system requirements check" -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot"
if ($Install) { Write-Host "Install mode: enabled" -ForegroundColor Yellow } else { Write-Host "Install mode: check only" }

Ensure-Git
Ensure-Node
$pythonCommand = Ensure-Python
Ensure-Rust
Ensure-WasmPack
Ensure-NodeDependencies

if ($Warnings.Count -gt 0) {
  Write-Section "Warnings"
  foreach ($warning in $Warnings) { Write-Host "- $warning" -ForegroundColor Yellow }
}

Write-Section "Summary"
if ($Failures.Count -gt 0) {
  foreach ($failure in $Failures) { Write-Host "- $failure" -ForegroundColor Red }
  Write-Host "Requirements check completed with failures." -ForegroundColor Red
  exit 1
}

Write-Ok "Requirements check completed."
Write-Host "Run the app with: npm start"
