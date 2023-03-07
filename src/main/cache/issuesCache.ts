import * as vscode from 'vscode';
import { ScanResults } from '../types/workspaceIssuesDetails';
import { Utils } from '../utils/utils';

/**
 * Describes a cache that holds all the information from an Xray scan for a workspace
 */
export class IssuesCache {
    public static readonly CACHE_BASE_KEY: string = 'jfrog.cache.issues.';

    constructor(public _cache: vscode.Memento) {}

    /**
     * Get the unique key for this workspace
     * @param workspace - the workspace we want to get it's id
     * @returns - the unique key for this workspace
     */
    public static toKey(workspace: vscode.WorkspaceFolder): string {
        return IssuesCache.CACHE_BASE_KEY + workspace.uri.fsPath;
    }

    /**
     * Check if the cache contains data for a given workspace
     * @param workspace - the workspace to search in the cache
     * @returns - true if exists in cache, false otherwise
     */
    public contains(workspace: vscode.WorkspaceFolder): boolean {
        return !this._cache.keys().find(key => key == IssuesCache.toKey(workspace));
    }

    /**
     * Get the workspace issues data that is stored in the cache base on a given workspace
     * @param workspace - the workspace to search it's data
     * @returns WorkspaceIssuesData if exists in cache, false otherwise.
     */
    public get(workspace: vscode.WorkspaceFolder): ScanResults | undefined {
        let rawData: string | undefined = this._cache.get(IssuesCache.toKey(workspace));
        if (rawData) {
            return ScanResults.fromJson(rawData);
        }
        return undefined;
    }

    /**
     * Store a workspace issues data in the cache
     * @param workspace - the workspace to store it's data
     * @param value - the data we want to store
     */
    public store(workspace: vscode.WorkspaceFolder, value: ScanResults) {
        return this._cache.update(IssuesCache.toKey(workspace), JSON.stringify(value));
    }

    /**
     * Remove issues data of workspace from cache
     * @param workspace - the workspace to delete it's data
     */
    public remove(workspace: vscode.WorkspaceFolder) {
        return this._cache.update(IssuesCache.toKey(workspace), undefined);
    }

    /**
     * Get a scan results stored in the cache base on a given workspace and make sure the results are relevant.
     * If the results are not relevant (the store interval period has passed) it will be removed them from the cache
     * @param workspace - the workspace to search it's data
     * @returns ScanResults if there are stored and relevant, undefined otherwise.
     */
    public getOrClearIfNotRelevant(workspace: vscode.WorkspaceFolder): ScanResults | undefined {
        let data: ScanResults | undefined = this.get(workspace);
        if (data && Utils.isIssueCacheIntervalPassed(data.oldestScanTimestamp)) {
            this.remove(workspace);
            return undefined;
        }
        return data;
    }
}
