# @entro314labs/web-icons-generator-cli-mcp 🎨

Generate all required web app icons and files from a single source image. Modern, fast, and framework-aware.

**Available as CLI, MCP Server, and Claude Desktop Extension!**

## Features

✅ **Auto-detects `app-icon.svg` or `app-icon.png`** in current directory
✅ **Generates 8 essential files** (2025 best practices)
✅ **Framework auto-detection** (Next.js, Astro, SvelteKit, Remix, Vite)
✅ **Generates in current directory** when run (respects `process.cwd()`)
✅ **SVG and PNG support** with automatic conversion
✅ **Maskable icon** with safe zone padding (Android 13+)
✅ **Monochrome Safari pinned tab** icon
✅ **site.webmanifest** generation
✅ **HTML snippet** ready to copy/paste
✅ **MCP Server** for Claude Desktop integration
✅ **Claude Desktop Extension** with quick actions
✅ **Zero config** – works out of the box

## Installation

```bash
# Run directly with npx (no installation needed)
npx @entro314labs/web-icons-generator-cli-mcp source.svg

# Shorter aliases
npx @entro314labs/web-icons-generator-cli-mcp@latest
# After install: create-icons, webicons, or web-icons-generator-cli-mcp

# Or install globally
npm install -g @entro314labs/web-icons-generator-cli-mcp
create-icons  # shortest command!
webicons     # also works
```

## Usage

### Zero Config (Recommended)

```bash
# Place app-icon.svg or app-icon.png in your project root
cd my-project
npx @entro314labs/web-icons-generator-cli-mcp
# ✓ Found app-icon.svg in current directory
# ✓ Detected Next.js → using public/ directory
# ✨ Success! Generated 8 files
```

### Basic Usage

```bash
# With source file as argument
npx @entro314labs/web-icons-generator-cli-mcp logo.svg

# Or if installed globally (use shorter commands)
create-icons logo.svg
webicons logo.svg

# Interactive mode (prompts for source if not found)
create-icons
```

### Advanced Options

```bash
# Specify output directory
create-icons logo.svg --output ./public

# Custom Safari pinned tab color
create-icons logo.svg --color "#ff5733"

# Choose generation mode
create-icons logo.svg --mode nextjs    # Next.js App Router (app/)
create-icons logo.svg --mode traditional  # Traditional web app (public/)
create-icons logo.svg --mode auto      # Auto-detect (default)

# Full example
create-icons logo.svg -o ./app -m nextjs -c "#1a1a1a"
```

## Generation Modes

The tool supports two generation modes for maximum compatibility:

### 🚀 Next.js App Router Mode (`--mode nextjs`)

**Perfect for Next.js 13+ with App Router**

Generated files (in `app/` directory):
- `favicon.ico` (32×32)
- `icon.png` (512×512) - auto-linked by Next.js
- `apple-icon.png` (180×180) - auto-linked by Next.js
- `apple-touch-icon.png` (180×180) - for compatibility
- `icon.svg` (if source is SVG) - auto-linked by Next.js

**Benefits:**
- ✅ Zero configuration - icons auto-linked by Next.js
- ✅ No manual `<head>` tags needed
- ✅ Automatic metadata generation
- ✅ Cleaner project structure

**Usage:**
```bash
create-icons logo.svg --mode nextjs
# or let it auto-detect
create-icons logo.svg  # detects Next.js App Router automatically
```

### 📁 Traditional Mode (`--mode traditional`)

**Perfect for all other frameworks and traditional web apps**

Generated files (in `public/` directory):
- `favicon.ico` (32×32)
- `icon.svg` (scalable)
- `icon-192.png` (192×192) - for PWA
- `icon-512.png` (512×512) - for PWA
- `apple-touch-icon.png` (180×180)
- `icon-maskable.png` (512×512, with padding) - for Android
- `safari-pinned-tab.svg` (monochrome) - for Safari
- `site.webmanifest` (PWA manifest)

**Requires:** Manual HTML integration (copy from `html-snippet.txt`)

**Usage:**
```bash
create-icons logo.svg --mode traditional
```

## Generated Files

## Generated Files

**Traditional Mode** generates these files in your output directory:

```
/public/
  ├── favicon.ico              (32×32)
  ├── icon.svg                 (scalable)
  ├── icon-192.png             (192×192)
  ├── icon-512.png             (512×512)
  ├── apple-touch-icon.png     (180×180)
  ├── icon-maskable.png        (512×512, with padding)
  ├── safari-pinned-tab.svg    (monochrome)
  ├── site.webmanifest         (PWA manifest)
  └── html-snippet.txt         (copy/paste to <head>)
```

**Next.js App Router Mode** generates these files in your app directory:

```
/app/
  ├── favicon.ico              (32×32)
  ├── icon.png                 (512×512, auto-linked)
  ├── icon.svg                 (scalable, auto-linked)
  ├── apple-icon.png           (180×180, auto-linked)
  ├── apple-touch-icon.png     (180×180, compatibility)
  └── html-snippet.txt         (integration guide)
```

## Framework Detection

The tool automatically detects your framework and uses the correct output directory and mode:

| Framework  | Config File        | Default Mode | Output Directory |
|------------|-------------------|--------------|------------------|
| Next.js (App Router) | `next.config.js` + `app/` | `nextjs` | `app/` |
| Next.js (Pages) | `next.config.js` | `traditional` | `public/` |
| Astro      | `astro.config.mjs`| `traditional` | `public/`        |
| SvelteKit  | `svelte.config.js`| `traditional` | `static/`        |
| Remix      | `remix.config.js` | `traditional` | `public/`        |
| Vite       | `vite.config.js`  | `traditional` | `public/`        |
| **Default**    | **None detected**     | `traditional` | **`public/`** |

## HTML Integration

### Next.js App Router (Auto-Linked)

No manual HTML needed! Next.js automatically generates these tags:

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/icon.png" type="image/png" sizes="512x512" />
<link rel="apple-touch-icon" href="/apple-icon.png" />
<link rel="icon" href="/icon.svg" type="image/svg+xml" />
```

### Traditional Mode (Manual Integration)

After generation, copy the contents of `html-snippet.txt` to your HTML `<head>`:

```html
<!-- Favicon (modern + fallback) -->
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<!-- Web App Manifest (PWA) -->
<link rel="manifest" href="/site.webmanifest">

<!-- Safari Pinned Tab -->
<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5">
```

## Requirements

- **Node.js** 18 or higher
- **Source image** in SVG, PNG, or JPG format
- For best results, use **square SVG** with transparent background

## Supported Input Formats

- `.svg` – Recommended (scalable, generates all files)
- `.png` – Good (generates raster icons, SVG files need manual creation)
- `.jpg`/`.jpeg` – Acceptable (generates raster icons, SVG files need manual creation)

## How It Works

1. **Looks for `app-icon.svg` or `app-icon.png`** in current directory (or uses provided path)
2. **Detects your framework** (Next.js, Astro, etc.) and determines the best generation mode
3. **Auto-selects mode**: Next.js App Router → `nextjs` mode, others → `traditional` mode
4. **Converts & resizes** your source image to all required sizes for the selected mode
5. **Generates maskable icon** with proper 20% safe zone padding (traditional mode)
6. **Creates monochrome SVG** for Safari pinned tabs (SVG sources only, traditional mode)
7. **Generates manifest** with correct icon references (traditional mode)
8. **Outputs integration guide** in `html-snippet.txt`

## Why This Tool?

Most icon generators are:
- ❌ Outdated (generate 30+ unnecessary files)
- ❌ Online-only (require uploading your logo)
- ❌ Not framework-aware (manual directory setup)
- ❌ Missing modern features (maskable icons, SVG favicons)
- ❌ Don't support Next.js App Router conventions

This tool:
- ✅ Generates only what you need (2025 standards)
- ✅ Works offline (CLI-based)
- ✅ Auto-detects your framework
- ✅ Includes modern PWA features
- ✅ **Supports Next.js App Router with zero-config auto-linking**
- ✅ **Dual-mode support**: traditional web apps + Next.js

## Examples

### Example 1: Zero Config (Recommended)

```bash
cd my-nextjs-app
# Create app-icon.svg in the project root
create-icons
# ✓ Found app-icon.svg in current directory
# ✓ Detected Next.js → using public/ directory
# ✨ Success! Generated 8 files
```

### Example 2: Next.js Project with Custom Path

```bash
cd my-nextjs-app
create-icons assets/logo.svg
# ✓ Detected Next.js → using public/ directory
# ✨ Success! Generated 8 files
```

### Example 3: Custom Output

```bash
create-icons assets/brand.svg --output static/icons
# Generated icons in static/icons/
```

### Example 4: Brand Color

```bash
create-icons logo.svg --color "#ff6b35"
# Safari pinned tab will use #ff6b35
```

## Browser Support

| File | Supported Browsers |
|------|-------------------|
| `favicon.ico` | All browsers (legacy fallback) |
| `icon.svg` | Chrome 80+, Firefox 41+, Safari 9+ |
| `apple-touch-icon.png` | iOS Safari, macOS Safari |
| `icon-192.png`, `icon-512.png` | Chrome/Edge (PWA), Android |
| `icon-maskable.png` | Android 13+ (adaptive icons) |
| `safari-pinned-tab.svg` | Safari 9+ (pinned tabs) |

## Troubleshooting

### "Source file not found"
- Ensure the path to your source image is correct
- Use relative or absolute paths: `./logo.svg` or `/Users/you/project/logo.svg`

### "Invalid file format"
- Only SVG, PNG, and JPG are supported
- Convert other formats (WebP, GIF) to PNG first

### Icons not displaying
1. Ensure files are at domain root (`https://yourdomain.com/favicon.ico`)
2. Check HTML `<head>` tags are present
3. Clear browser cache (hard refresh: Cmd+Shift+R / Ctrl+Shift+R)

## MCP Server & Claude Desktop

This package includes an MCP (Model Context Protocol) server for integration with Claude Desktop. **4 tools available** for complete icon workflows.

### Quick Setup

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "web-icons": {
      "command": "npx",
      "args": ["-y", "@entro314labs/web-icons-generator-cli-mcp", "--mcp"]
    }
  }
}
```

### Available Tools

1. **`generate_web_icons`** - Generate icons + manifest from any source image
2. **`auto_generate_icons`** - Zero-config generation (finds app-icon.svg/png)
3. **`check_icons_status`** - Audit which icons exist/missing
4. **`integrate_icons_html`** - Automatically add icon tags to HTML files

### Usage with Claude

Ask Claude to help with icons:
- "Generate web icons for my Next.js project"
- "Check if my project has all required icons"
- "Create icons from logo.svg and add them to my HTML"
- "Add icon tags to my index.html file"

**See [MCP-TOOLS.md](./MCP-TOOLS.md) for detailed tool reference.**

See **[MCP.md](./MCP.md)** for complete documentation.

## Development

```bash
# Clone repository
git clone https://github.com/entro314-labs/web-icons-generator-cli-mcp.git
cd web-icons-generator-cli-mcp

# Install dependencies
npm install

# Build
npm run build

# Test CLI
npm link
web-icons-generator-cli-mcp test.svg

# Test MCP server
web-icons-generator-cli-mcp --mcp
```
```

## License

MIT

## Credits

Built with:
- [sharp](https://sharp.pixelplumbing.com/) – High-performance image processing
- [commander](https://github.com/tj/commander.js) – CLI framework
- [ora](https://github.com/sindresorhus/ora) – Elegant terminal spinners
- [chalk](https://github.com/chalk/chalk) – Terminal styling
- [prompts](https://github.com/terkelg/prompts) – Interactive prompts

---

Made with ❤️ for modern web developers who want simple, correct icon generation.
