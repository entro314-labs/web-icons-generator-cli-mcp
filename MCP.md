# MCP Server & Claude Desktop Extension

This package includes **three ways** to use the web icons generator:

## 1. 🖥️ CLI Tool (Command Line)

```bash
# Use directly with npx
npx create-web-icons

# Or install globally
npm install -g create-web-icons
create-web-icons
```

## 2. 🤖 MCP Server (Model Context Protocol)

Integrate with Claude Desktop or any MCP-compatible client.

### Setup in Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "web-icons": {
      "command": "npx",
      "args": ["-y", "create-web-icons", "--mcp"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "web-icons": {
      "command": "create-web-icons",
      "args": ["--mcp"]
    }
  }
}
```

### Available MCP Tools

The MCP server provides **4 standardized tools** for complete icon workflows. See [MCP-TOOLS.md](./MCP-TOOLS.md) for detailed reference.

#### `generate_web_icons`
Generate all web icons (8 files), PWA manifest, and HTML snippet from any source image.

**Parameters:**
- `sourcePath` (required): Path to source image (SVG, PNG, JPG)
- `outputDir` (optional): Output directory (auto-detected if not provided)
- `color` (optional): Hex color for Safari pinned tab (default: #5bbad5)
- `projectPath` (optional): Project root for framework detection

#### `auto_generate_icons`
Zero-config: automatically find `app-icon.svg` or `app-icon.png` and generate all icons + manifest.

**Parameters:**
- `projectPath` (required): Project root directory
- `color` (optional): Hex color for Safari pinned tab (default: #5bbad5)

#### `check_icons_status`
Audit which icons exist and which are missing. Returns detailed status report.

**Parameters:**
- `projectPath` (required): Project root directory

#### `integrate_icons_html`
**NEW:** Automatically add icon link tags to HTML files. Auto-detects index.html or framework layout files.

**Parameters:**
- `projectPath` (required): Project root directory
- `htmlPath` (optional): Specific HTML file (auto-detects if not provided)
- `color` (optional): Hex color for Safari pinned tab (default: #5bbad5)

**Features:**
- Auto-detects HTML entry points (index.html, layout.tsx, +layout.svelte, etc.)
- Inserts proper favicon, PWA manifest, and Apple icon tags
- Prevents duplicate tag insertion
- Supports all major frameworks

### Using with Claude

Once configured, you can ask Claude:

```
"Generate web icons for my Next.js project at ~/projects/my-app"
"Check icon status for the current project"
"Create icons from /path/to/logo.svg and add them to my HTML"
"Add icon tags to my index.html file"
```

Claude will automatically use the MCP tools to complete these tasks.

## 3. 🎨 Claude Desktop Extension (MCPB Bundle)

Install the extension with one click using the `.mcpb` file.

### Building the Extension

```bash
# Build TypeScript first
pnpm build

# Package as .mcpb extension
npx @anthropic-ai/mcpb pack
```

This creates `web-icons-generator-1.0.0.mcpb` - a single-click installable extension.

### Installation

#### Via Claude Desktop:
1. Build the `.mcpb` file (see above)
2. Drag `web-icons-generator-1.0.0.mcpb` into Claude Desktop Settings → Extensions
3. Click "Install"

#### Manual Testing:
```bash
# Extract and inspect
unzip web-icons-generator-1.0.0.mcpb -d test-extract
cd test-extract
cat manifest.json
```

### Extension Features

The MCPB bundle includes:
- **All dependencies** - No need for Node.js installation
- **Auto-updates** - Extensions update automatically
- **Secure config** - Stores settings in OS keychain
- **Cross-platform** - Works on macOS, Windows, Linux

### Manifest Structure

The extension uses `manifest.json` (manifest_version: 0.3):

```json
{
  "manifest_version": "0.3",
  "name": "web-icons-generator",
  "display_name": "Web Icons Generator",
  "server": {
    "type": "node",
    "entry_point": "dist/mcp.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/dist/mcp.js"]
    }
  },
  "tools": [...]
}
```

See full manifest at `manifest.json` in the project root.

## Comparison

| Feature | CLI | MCP Server | Desktop Extension |
|---------|-----|------------|-------------------|
| **Interactive prompts** | ✅ Yes | ❌ No | ✅ Yes |
| **Claude integration** | ❌ No | ✅ Yes | ✅ Yes |
| **GUI** | ❌ No | ❌ No | ✅ Yes |
| **Automation** | ⚠️ Scripts | ✅ AI-driven | ✅ One-click |
| **Framework detection** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Zero config** | ✅ Yes | ✅ Yes | ✅ Yes |

## Testing MCP Server

### Test with MCP Inspector

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Test the server
mcp-inspector npx create-web-icons --mcp
```

### Test manually

```bash
# Start MCP server
create-web-icons --mcp

# In another terminal, send JSON-RPC request
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | create-web-icons --mcp
```

### Debug Mode

```bash
# Run with debug output
DEBUG=mcp:* create-web-icons --mcp
```

## Development

### Building

```bash
pnpm install
pnpm build
```

### Testing locally

```bash
# Link globally
pnpm link --global

# Test CLI
create-web-icons

# Test MCP
create-web-icons --mcp
```

### Project Structure

```
create-web-icons/
├── src/
│   ├── cli.ts          # CLI entry point
│   ├── mcp.ts          # MCP server
│   ├── generator.ts    # Core icon generation logic (shared)
│   ├── types.ts        # Shared types
│   └── utils.ts        # Shared utilities
├── claude-extension/   # Claude Desktop extension
│   ├── manifest.json   # Extension metadata
│   ├── index.ts        # Extension code
│   ├── icon.svg        # Extension icon
│   └── README.md       # Extension docs
└── dist/              # Compiled output
```

## Troubleshooting

### MCP Server not connecting

1. Check Claude Desktop config syntax (valid JSON)
2. Ensure `create-web-icons` is installed: `npm list -g create-web-icons`
3. Try absolute path: `"command": "/usr/local/bin/create-web-icons"`
4. Check logs: `~/Library/Logs/Claude/mcp-server-web-icons.log`

### Extension not showing

1. Verify extension folder location
2. Check `manifest.json` is valid JSON
3. Restart Claude Desktop completely
4. Check Claude Desktop → Settings → Extensions

### Permission errors

MCP server needs read/write access to your project directories. If using Claude Desktop, it will prompt for permissions.

## Support

- **Issues**: https://github.com/entro314-labs/create-web-icons/issues
- **Docs**: https://github.com/entro314-labs/create-web-icons#readme
- **MCP Spec**: https://modelcontextprotocol.io

## License

MIT
