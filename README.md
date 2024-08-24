# ZipFiles VSCode Extension

ZipFiles is a Visual Studio Code extension that allows you to quickly combine multiple files into a single text output, making it easy to share code snippets or create consolidated views of your project files.

## Features

- Combine multiple files into a single text output
- Customizable include and exclude patterns for file selection
- Option to add filename comments to the combined output
- Project-specific configuration using `.zipfilesrc` file
- Progress indicator for large file operations
- Detailed metadata about the combined files

## Installation

1. Open Visual Studio Code
2. Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X)
3. Search for "ZipFiles"
4. Click Install

## Usage

1. Select one or more files or folders in the VS Code file explorer
2. Right-click and select "Zip Files" from the context menu, or use the command palette (Ctrl+Shift+P or Cmd+Shift+P) and search for "Zip Files"
3. The extension will combine the selected files based on your configuration
4. The combined code will be copied to your clipboard, and you'll see a notification with metadata about the operation

## Configuration

You can configure ZipFiles using VS Code settings or a project-specific `.zipfilesrc` file.

### VS Code Settings

Open your VS Code settings (File > Preferences > Settings) and search for "ZipFiles" to find the following options:

- `zipFiles.includePatterns`: Array of glob patterns for files to include
- `zipFiles.excludePatterns`: Array of glob patterns for files to exclude
- `zipFiles.addFilenameComments`: Boolean to toggle adding filename comments in the output

### Project-specific Configuration

Create a `.zipfilesrc` file in your project root directory with the following structure:

```json
{
  "includePatterns": ["**/*.{js,ts}", "**/*.md"],
  "excludePatterns": ["**/node_modules/**", "**/dist/**"],
  "addFilenameComments": true
}
```

The `.zipfilesrc` configuration takes precedence over VS Code settings.

## Default Configuration

If no custom configuration is provided, ZipFiles uses the following default settings:

- Include patterns:

  - `**/*.{js,ts,jsx,tsx}`
  - `**/*.{html,css,scss,sass,less}`
  - `**/*.{json,md,yml,yaml}`
  - `**/*.{py,rb,java,go,rs}`

- Exclude patterns:

  - `**/node_modules/**`
  - `**/dist/**`
  - `**/build/**`
  - `**/.git/**`
  - `**/.DS_Store`
  - `**/*.log`
  - `**/tmp/**`
  - `**/.vscode/**`
  - `**/.idea/**`
  - `**/coverage/**`

- Add filename comments: `true`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
