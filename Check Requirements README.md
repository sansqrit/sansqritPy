# SansqritPy Bootstrap Scripts

These scripts are kept separate from the application source code. They check the system requirements needed to run and build SansqritPy, then optionally install missing tools.

## Windows PowerShell

Check only:

```powershell
powershell -ExecutionPolicy Bypass -File .\bootstrap\check-requirements.ps1
```

Check and install missing tools:

```powershell
powershell -ExecutionPolicy Bypass -File .\bootstrap\check-requirements.ps1 -Install
```

## Linux / macOS Bash

Check only:

```bash
bash ./bootstrap/check-requirements.sh
```

Check and install missing tools:

```bash
bash ./bootstrap/check-requirements.sh --install
```

## What Is Checked

- Git
- Node.js 18 or newer
- npm
- Python 3.8 or newer
- Rust toolchain through `rustup`
- Cargo
- Rust target `wasm32-unknown-unknown`
- `wasm-pack`

## Notes

- Install mode uses the system package manager when available.
- Windows install mode prefers `winget`, then Chocolatey, then Scoop.
- Linux install mode supports `apt`, `dnf`, `yum`, `pacman`, and `zypper`.
- macOS install mode supports Homebrew.
- Some installs require administrator/sudo permission.
- After installing Node, Python, Rust, or Git, open a new terminal if the command is still not detected.
