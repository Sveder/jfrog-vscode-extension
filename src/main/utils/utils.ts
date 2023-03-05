import * as pathUtils from 'path';
import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import AdmZip, { IZipEntry } from 'adm-zip';
import { ScanUtils } from './scanUtils';

export class Utils {
    private static readonly MAX_FILES_EXTRACTED_ZIP: number = 1000;
    // 1 GB
    private static readonly MAX_SIZE_EXTRACTED_ZIP_BYTES: number = 1000000000;
    private static readonly COMPRESSION_THRESHOLD_RATIO: number = 100;
    // week
    private static readonly OLDEST_SCAN_CACHE_SAVE_INTERVAL_MILLISECS: number = 1000 * 60 * 60 * 24 * 7;

    /**
     *  @returns the last segment of a path.
     * @param path
     *
     */
    public static getLastSegment(path: string): string {
        if (path === '') {
            return '';
        }
        return path.substring(path.lastIndexOf(pathUtils.sep) + 1);
    }

    public static tryRelativePath(full: string, potentialParent?: string): string {
        if (potentialParent && full.startsWith(potentialParent)) {
            let localPath: string = full.substring(potentialParent.length + 1);
            return './' + localPath;
        }
        return full;
    }

    public static createNodeCommand(name: string, title: string, args: any[]): vscode.Command {
        return {
            command: name,
            title: title,
            arguments: args
        };
    }

    public static getLastScanString(timeStamp: number | undefined): string {
        if (timeStamp) {
            return "scan completed at '" + this.toDate(timeStamp) + "'";
        }
        return '';
    }

    public static isIssueCacheIntervalPassed(timeStamp: number | undefined): boolean {
        if (!timeStamp) {
            return false;
        }
        return Date.now() - timeStamp > Utils.OLDEST_SCAN_CACHE_SAVE_INTERVAL_MILLISECS;
    }

    public static toDate(timeStamp: number | undefined): string {
        if (timeStamp == undefined) {
            return 'Never';
        }
        return new Date(timeStamp).toUTCString();
    }

    public static addZipSuffix(str: string): string {
        return str + '.zip';
    }

    public static saveAsZip(zipPath: string, ...files: { fileName: string; content: string }[]): void {
        let zip: AdmZip = new AdmZip();
        for (let file of files) {
            zip.addFile(file.fileName, Buffer.alloc(file.content.length, file.content));
        }
        zip.writeZip(zipPath);
    }

    static extractZip(zipPath: string, targetDir: string, overwrite: boolean = true, keepOriginalPermission: boolean = true): any {
        if (!fs.existsSync(zipPath)) {
            return '';
        }
        Utils.createDirIfNotExists(targetDir);
        let zip: AdmZip = new AdmZip(zipPath);
        let fileCount: number = 0;
        let totalSize: number = 0;

        zip.getEntries().forEach(entry => {
            // Protect against zip bomb
            fileCount++;
            if (fileCount > Utils.MAX_FILES_EXTRACTED_ZIP) {
                throw new ZipExtractError(zipPath, 'Reached max files allowed');
            }

            let entrySize: number = entry.getData().length;
            totalSize += entrySize;
            if (totalSize > Utils.MAX_SIZE_EXTRACTED_ZIP_BYTES) {
                throw new ZipExtractError(zipPath, 'Reached max size allowed');
            }

            let compressionRatio: number = entrySize / entry.header.compressedSize;
            if (compressionRatio > Utils.COMPRESSION_THRESHOLD_RATIO) {
                throw new ZipExtractError(zipPath, 'Reached max compression ratio allowed');
            }

            if (entry.isDirectory) {
                return;
            }

            if (!zip.extractEntryTo(entry, targetDir, true, overwrite, keepOriginalPermission)) {
                throw new ZipExtractError(zipPath, "can't extract entry " + entry.entryName);
            }
        });
    }

    public static extractZipEntry(zipPath: string, name: string): any {
        if (!fs.existsSync(zipPath)) {
            return '';
        }
        let zip: AdmZip = new AdmZip(zipPath);

        let entry: IZipEntry | null = zip.getEntry(name);
        if (!entry) {
            throw new ZipExtractError(zipPath, 'Could not find expected content ' + name);
        }
        return entry.getData().toString('utf8');
    }

    public static addWinSuffixIfNeeded(str: string): string {
        return str + (os.platform() === 'win32' ? '.exe' : '');
    }

    public static createDirIfNotExists(dirPath: string, createRecursive: boolean = true) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: createRecursive } as fs.MakeDirectoryOptions);
        }
    }

    public static removeDirIfExists(dirPath: string) {
        if (fs.existsSync(dirPath)) {
            ScanUtils.removeFolder(dirPath);
        }
    }

    public static removeFileIfExists(filePath: string) {
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath);
        }
    }

    public static getArchitecture(): string {
        if (Utils.isWindows()) {
            return 'windows-amd64';
        }
        if (os.platform().includes('darwin')) {
            return os.arch() === 'arm64' ? 'mac-arm64' : 'mac-amd64';
        }
        if (os.arch().includes('arm')) {
            return os.arch().includes('64') ? 'linux-arm64' : 'linux-arm';
        }
        return os.arch().includes('64') ? 'linux-amd64' : 'linux-386';
    }

    public static isWindows(): boolean {
        return os.platform().startsWith('win');
    }
}

export class ZipExtractError extends Error {
    constructor(public readonly zipPath: string, reason: string) {
        super('Zip extraction error: ' + reason + ' in zip ' + zipPath);
    }
}
