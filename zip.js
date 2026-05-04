import { inflateRawSync } from "node:zlib";

const textDecoder = new TextDecoder("utf-8", { fatal: false });
const allowedExtensions = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".html",
  ".css",
  ".scss",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".xml",
  ".sql",
  ".env",
  ".txt",
]);

function extensionOf(path) {
  const normalized = path.toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot >= 0 ? normalized.slice(dot) : "";
}

function shouldIndex(path, size) {
  const lower = path.toLowerCase();
  if (size > 250_000) return false;
  if (lower.includes("__macosx/")) return false;
  if (lower.includes("node_modules/")) return false;
  if (lower.includes(".git/")) return false;
  if (lower.includes("dist/") || lower.includes("build/")) return false;
  return allowedExtensions.has(extensionOf(lower)) || lower.includes("dockerfile");
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === signature) return i;
  }
  throw new Error("Invalid ZIP file: central directory not found.");
}

export function parseZipBuffer(buffer) {
  if (!buffer?.length) {
    throw new Error("ZIP file is empty.");
  }

  const eocd = findEndOfCentralDirectory(buffer);
  const entries = buffer.readUInt16LE(eocd + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);
  const files = [];
  let cursor = centralDirectoryOffset;

  for (let i = 0; i < entries; i += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;

    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const rawName = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength);
    const name = textDecoder.decode(rawName).replace(/\\/g, "/");

    cursor += 46 + fileNameLength + extraLength + commentLength;

    if (name.endsWith("/") || !shouldIndex(name, uncompressedSize)) {
      continue;
    }

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      continue;
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let content;

    if (compression === 0) {
      content = compressed;
    } else if (compression === 8) {
      content = inflateRawSync(compressed);
    } else {
      continue;
    }

    files.push({
      path: name.split("/").slice(1).join("/") || name,
      content: textDecoder.decode(content),
      size: uncompressedSize,
    });
  }

  if (!files.length) {
    throw new Error("No indexable source files were found in the ZIP.");
  }

  return files;
}
