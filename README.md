# PolyTrack Decoder and Encoder

A Python/Tkinter application for encoding and decoding PolyTrack `.track` files.


## Browser Version (GitHub Pages)

This repository also includes a browser-based converter. It runs the existing Python encoder and decoder with Pyodide, so the conversion happens locally in the visitor's browser; no Python installation or backend server is needed.

After GitHub Pages is configured to use **GitHub Actions** as its build and deployment source, every push to `main` deploys the site automatically:

- **Browser app:** https://tastysoup10-blip.github.io/Polytrack-decoder-and-encoder/
- **Workflow:** `.github/workflows/pages.yml`

The first visit downloads the Pyodide runtime from its CDN. The app also fetches `polytrack_encoder.py` and `polytrack_decoder.py` from this repository. The original desktop application and release workflow remain available.

## Downloads

You do not need Python to use a released build.

Open the repository's **Releases** page and download the build for your operating system:

- **Windows x64:** `Polytrack-Windows-x64.exe`
- **macOS Intel:** `Polytrack-macOS-Intel.zip`
- **macOS Apple Silicon:** `Polytrack-macOS-Apple-Silicon.zip`
- **Linux x64:** `Polytrack-Linux-x64.tar.gz`

### Windows

Download `Polytrack-Windows-x64.exe` and run it.

### macOS

Download the ZIP matching your Mac, extract it, and open `Polytrack.app`.

On first launch, macOS may require you to approve an app downloaded from the internet in **System Settings > Privacy & Security**. This project is not code-signed or notarized unless a release specifically says otherwise.

### Linux

Extract the archive:

```bash
tar -xzf Polytrack-Linux-x64.tar.gz
```

Run:

```bash
./Polytrack
```

If Linux reports that the file is not executable:

```bash
chmod +x Polytrack
./Polytrack
```

Linux distributions may need Tk support installed by the operating system.

## Building From Source

### Requirements

For a local build, install:

- Python 3.10 or newer
- PyInstaller
- Tkinter/Tk development/runtime support for your operating system

Clone the repository:

```bash
git clone https://github.com/Tastysoup10/Polytrack-decoder-and-encoder.git
cd Polytrack-decoder-and-encoder
```

### Windows

```bash
python -m pip install --upgrade pyinstaller
python -m PyInstaller --clean --noconfirm Polytrack_singlefile.spec
```

Output:

```text
dist\Polytrack.exe
```

### macOS

Build on a Mac. PyInstaller does not cross-compile a macOS application from Windows or Linux.

```bash
python3 -m pip install --upgrade pyinstaller
python3 -m PyInstaller --clean --noconfirm Polytrack_macos.spec
```

Output:

```text
dist/Polytrack.app
```

You can also use:

```bash
./scripts/build_macos.sh
```

### Linux

Build on Linux:

```bash
python3 -m pip install --upgrade pyinstaller
python3 -m PyInstaller --clean --noconfirm Polytrack_linux.spec
```

Output:

```text
dist/Polytrack
```

Or:

```bash
./scripts/build_linux.sh
```

## Automated Multi-Platform Releases

This repository includes a GitHub Actions workflow at:

```text
.github/workflows/build.yml
```

The workflow builds:

- Windows x64
- macOS Intel
- macOS Apple Silicon
- Linux x64

### Creating a release

Create and push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build all four platform versions and attach them to the GitHub Release for that tag.

You can also start the workflow manually from the repository's **Actions** tab. A manually started workflow builds downloadable Actions artifacts but does not create a release unless it was triggered by a `v*` tag.

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── build.yml
├── scripts/
│   ├── build_linux.sh
│   └── build_macos.sh
├── polytrack_gui_scrollable.py
├── polytrack_encoder.py
├── polytrack_decoder.py
├── Polytrack_singlefile.spec
├── Polytrack_macos.spec
├── Polytrack_linux.spec
├── build_Polytrack_windows.bat
├── README.md
└── LICENSE
```

## License

MIT License.

Copyright (c) 2026 Tastysoup10
