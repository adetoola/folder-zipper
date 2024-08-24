import * as path from 'path';

import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as vscode from 'vscode';

// Constants
const CONFIG_SECTION = "zipFiles";
const PUBLISHER_NAME = "adetoola";
// Interfaces
interface ZipFilesConfig {
  includePatterns: string[];
  excludePatterns: string[];
  addFilenameComments: boolean;
}

/**
 * Retrieves the default configuration from package.json.
 * @returns {Promise<ZipFilesConfig>} A promise that resolves to the default configuration.
 */
async function getDefaultConfig(): Promise<ZipFilesConfig> {
  const extensionPath = vscode.extensions.getExtension(
    `${PUBLISHER_NAME}.zip-files`
  )?.extensionPath;
  if (!extensionPath) {
    throw new Error("Unable to locate extension path");
  }

  const packageJsonPath = path.join(extensionPath, "package.json");
  const packageJsonContent = await fs.readFile(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonContent);

  return {
    includePatterns:
      packageJson.contributes.configuration.properties[
        "zipFiles.includePatterns"
      ].default,
    excludePatterns:
      packageJson.contributes.configuration.properties[
        "zipFiles.excludePatterns"
      ].default,
    addFilenameComments:
      packageJson.contributes.configuration.properties[
        "zipFiles.addFilenameComments"
      ].default,
  };
}

/**
 * Attempts to read and parse the .zipfilesrc file from the workspace root.
 * @returns {Promise<Partial<ZipFilesConfig> | null>} A promise that resolves to the parsed config or null if not found.
 */
async function readZipFilesRcConfig(): Promise<Partial<ZipFilesConfig> | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    return null;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const rcFilePath = path.join(workspaceRoot, ".zipfilesrc");

  try {
    const fileContent = await fs.readFile(rcFilePath, "utf8");
    const config = JSON.parse(fileContent);
    console.log("Found .zipfilesrc config:", config);
    return config;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.log("No .zipfilesrc file found");
      return null;
    }
    console.error("Error reading .zipfilesrc file:", error);
    return null;
  }
}

/**
 * Retrieves the configuration for the ZipFiles extension, merging .zipfilesrc, VSCode settings, and default values.
 * @returns {Promise<ZipFilesConfig>} A promise that resolves to the merged configuration object.
 */
async function getZipFilesConfig(): Promise<ZipFilesConfig> {
  const defaultConfig = await getDefaultConfig();
  const vscodeConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const rcConfig = await readZipFilesRcConfig();

  const mergedConfig: ZipFilesConfig = {
    includePatterns:
      rcConfig?.includePatterns ??
      vscodeConfig.get("includePatterns", defaultConfig.includePatterns),
    excludePatterns:
      rcConfig?.excludePatterns ??
      vscodeConfig.get("excludePatterns", defaultConfig.excludePatterns),
    addFilenameComments:
      rcConfig?.addFilenameComments ??
      vscodeConfig.get(
        "addFilenameComments",
        defaultConfig.addFilenameComments
      ),
  };

  console.log("Merged ZipFiles configuration:", mergedConfig);
  return mergedConfig;
}

/**
 * Converts an absolute file path to a path relative to the workspace root.
 * @param {string} absoluteFilePath - The absolute path of the file.
 * @returns {string} The relative path of the file.
 */
function getRelativeFilePath(absoluteFilePath: string): string {
  console.log(`Getting relative path for: ${absoluteFilePath}`);
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const folderPath = folder.uri.fsPath;
      if (absoluteFilePath.startsWith(folderPath)) {
        return path.relative(folderPath, absoluteFilePath).replace(/\\/g, "/");
      }
    }
  }
  return absoluteFilePath;
}

/**
 * Finds files in the given directory based on the provided configuration.
 * @param {string} baseDirectory - The base directory to search in.
 * @param {ZipFilesConfig} config - The configuration object containing include and exclude patterns.
 * @returns {Promise<string[]>} A promise that resolves to an array of file paths.
 */
async function findMatchingFiles(
  baseDirectory: string,
  config: ZipFilesConfig
): Promise<string[]> {
  console.log(`Finding files in: ${baseDirectory}`);
  const allFiles: string[] = [];
  for (const pattern of config.includePatterns) {
    const files = await glob(pattern, {
      cwd: baseDirectory,
      ignore: config.excludePatterns,
      absolute: true,
    });
    allFiles.push(...files);
  }
  return [...new Set(allFiles)]; // Remove duplicates
}

/**
 * Reads the content of a file and optionally adds a filename comment.
 * @param {string} filePath - The path of the file to read.
 * @param {boolean} addComment - Whether to add a filename comment.
 * @returns {Promise<string>} A promise that resolves to the file content with optional comment.
 */
async function readFileContentWithOptionalComment(
  filePath: string,
  addComment: boolean
): Promise<string> {
  console.log(`Reading file: ${filePath}`);
  const relativePath = getRelativeFilePath(filePath);
  const content = await fs.readFile(filePath, "utf8");
  return addComment
    ? `// ${relativePath}\n${content.trim()}\n\n`
    : `${content.trim()}\n\n`;
}

/**
 * Combines the content of multiple files into a single string with progress reporting.
 *
 * @param {string[]} filePaths - An array of file paths to combine.
 * @param {ZipFilesConfig} config - The configuration object containing settings for file combination.
 * @param {function(string): void} onFileProcessed - Callback function to report progress for each processed file.
 * @returns {Promise<string>} A promise that resolves to the combined file contents.
 * @throws {Error} If there's an issue reading or combining the files.
 */
async function combineFileContents(
  filePaths: string[],
  config: ZipFilesConfig,
  onFileProcessed: (file: string) => void
): Promise<string> {
  console.log(`Combining ${filePaths.length} files`);
  try {
    const fileContents = await Promise.all(
      filePaths.map(async (filePath) => {
        const content = await readFileContentWithOptionalComment(
          filePath,
          config.addFilenameComments
        );
        onFileProcessed(filePath);
        return content;
      })
    );
    return fileContents.join("");
  } catch (error) {
    console.error("Error in combineFileContents:", error);
    throw new Error(
      `Failed to combine code files: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Copies the combined code to the clipboard and notifies the user with metadata.
 * @param {string} combinedCode - The combined code to copy to the clipboard.
 * @param {string[]} filePaths - An array of file paths that were combined.
 * @returns {Promise<void>}
 */
async function copyToClipboardAndNotifyUser(
  combinedCode: string,
  filePaths: string[]
): Promise<void> {
  console.log(`Copying ${filePaths.length} files to clipboard`);
  try {
    await vscode.env.clipboard.writeText(combinedCode);

    const totalSize = Buffer.byteLength(combinedCode, "utf8");
    const fileTypes = [...new Set(filePaths.map((file) => path.extname(file)))];

    const message =
      `Code from ${filePaths.length} file${
        filePaths.length !== 1 ? "s" : ""
      } has been copied to the clipboard.\n\nMetadata:\n` +
      `- Number of files: ${filePaths.length}\n` +
      `- Total size: ${(totalSize / 1024).toFixed(2)} KB\n` +
      `- File types: ${fileTypes.join(", ")}`;

    vscode.window.showInformationMessage(message);
  } catch (error) {
    console.error("Error in copyToClipboardAndNotifyUser:", error);
    vscode.window.showErrorMessage(
      `Failed to copy the combined code to the clipboard: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Handles the ZipFiles command execution with granular progress reporting.
 * This function orchestrates the process of finding, reading, and combining files,
 * while providing detailed progress updates to the user.
 *
 * @param {vscode.Uri[]} selectedUris - An array of selected URIs (files or folders).
 * @returns {Promise<void>}
 * @throws {Error} If there's an issue during file processing or clipboard operations.
 */
async function handleZipFilesCommand(
  selectedUris: vscode.Uri[]
): Promise<void> {
  console.log("Handling zipFiles command");
  const config = await getZipFilesConfig();
  const filePaths: string[] = [];
  let operationCompleted = false;

  // Define the weight of each step in the overall progress
  const progressWeights = {
    findingFiles: 0.3, // 30% of progress
    processingFiles: 0.6, // 60% of progress
    copyingToClipboard: 0.1, // 10% of progress
  };

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Combining code files",
      cancellable: true,
    },
    async (progress, token) => {
      try {
        // Step 1: Find all matching files
        const findingFilesIncrement =
          (progressWeights.findingFiles * 100) / selectedUris.length;
        for (const uri of selectedUris) {
          if (token.isCancellationRequested) {
            return;
          }
          console.log(`Processing URI: ${uri.fsPath}`);
          const stat = await fs.stat(uri.fsPath);
          if (stat.isDirectory()) {
            const files = await findMatchingFiles(uri.fsPath, config);
            console.log(`Files found: ${files}`);
            filePaths.push(...files);
          } else {
            filePaths.push(uri.fsPath);
          }
          progress.report({
            increment: findingFilesIncrement,
            message: `Finding files... (${filePaths.length} found)`,
          });
        }

        if (filePaths.length === 0) {
          console.log("No files found matching the include/exclude patterns");
          vscode.window.showErrorMessage(
            "No files found matching the include/exclude patterns."
          );
          return;
        }

        // Step 2: Process each file
        let processedFiles = 0;
        const totalFiles = filePaths.length;
        const processingFilesIncrement =
          (progressWeights.processingFiles * 100) / totalFiles;
        const combinedCode = await combineFileContents(
          filePaths,
          config,
          (file) => {
            if (token.isCancellationRequested) {
              return;
            }
            processedFiles++;
            progress.report({
              increment: processingFilesIncrement,
              message: `Processing files... (${processedFiles}/${totalFiles})`,
            });
          }
        );

        // Step 3: Copy to clipboard
        progress.report({
          increment: progressWeights.copyingToClipboard * 100,
          message: "Copying to clipboard...",
        });
        await copyToClipboardAndNotifyUser(combinedCode, filePaths);

        operationCompleted = true;
      } catch (error) {
        console.error("Error in handleZipFilesCommand:", error);
        vscode.window.showErrorMessage(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  if (!operationCompleted) {
    console.log("Operation was cancelled or failed");
    vscode.window.showInformationMessage(
      "File combination was cancelled or encountered an error."
    );
  }
}

/**
 * Activates the ZipFiles extension.
 * @param {vscode.ExtensionContext} context - The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("Activating ZipFiles extension");
  const disposable = vscode.commands.registerCommand(
    "extension.zipFiles",
    async (...args: any[]) => {
      const uris = args.flatMap((arg) =>
        arg instanceof vscode.Uri ? [arg] : []
      );
      if (uris.length === 0) {
        console.log("No files or folders selected");
        vscode.window.showErrorMessage(
          "Please select one or more files or folders to combine code."
        );
        return;
      }
      await handleZipFilesCommand(uris);
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * Deactivates the ZipFiles extension.
 */
export function deactivate() {
  console.log("Deactivating ZipFiles extension");
}
