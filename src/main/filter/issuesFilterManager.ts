import * as vscode from 'vscode';
import { ExtensionComponent } from '../extensionComponent';
//import { TreesManager } from '../treeDataProviders/treesManager';
import { SeverityNodeFilter } from './severityFilter';

enum FilterTypes {
    SEVERITY = '$(alert)   Issues severity',
    //LICENSE = '$(law)   Licenses',
    //SCOPE = '$(telescope)   Scope',
    CLEAR_ALL = '$(trashcan)   Reset filters'
}

export class IssuesFilterManager implements ExtensionComponent {
    private _severitiesFilter: SeverityNodeFilter;

    constructor() {
        //private _treesManager: TreesManager) {
        this._severitiesFilter = new SeverityNodeFilter(); //_treesManager.issuesTreeDataProvider);
    }

    public activate() {
        return this;
    }

    public async showFilterMenu() {
        let choice: string | undefined = await vscode.window.showQuickPick(this.getFilters(), <vscode.QuickPickOptions>{
            placeHolder: 'Filter',
            canPickMany: false
        });
        switch (choice) {
            case FilterTypes.SEVERITY:
                this._severitiesFilter.showFilterMenu(this);
                break;
            // case FilterTypes.LICENSE:
            //     this._licensesFilter.showFilterMenu(this);
            //     break;
            // case FilterTypes.SCOPE:
            //     this._scopeFilter.showFilterMenu(this);
            //     break;
            case FilterTypes.CLEAR_ALL:
                this._severitiesFilter.clearFilters();
            // this._licensesFilter.clearFilters();
            // this._scopeFilter.clearFilters();
            // this._treesManager.treeDataProviderManager.applyFilters(undefined);
        }
    }

    public getFilters(): string[] {
        let results: string[] = [];
        Object.values(FilterTypes).forEach(filterType => {
            // // Includes sub-menu of scopes in filters if there is at least one scope in the project.
            // if (filterType === FilterTypes.SCOPE && this._scopeFilter.getValues().length === 0) {
            //     return;
            // }
            results.push(filterType);
        });
        return results;
    }

    // public applyFilters() {
    //     let unfilteredRoot: DependenciesTreeNode = this._treesManager.treeDataProviderManager.getDisplayedDependenciesTree();
    //     if (!(unfilteredRoot instanceof DependenciesTreeNode)) {
    //         return;
    //     }
    //     let filteredRoot: DependenciesTreeNode = unfilteredRoot.shallowClone();
    //     this._applyFilters(unfilteredRoot, filteredRoot, { nodeSelected: true });
    //     this._treesManager.treeDataProviderManager.applyFilters(filteredRoot);
    // }

    // private _applyFilters(unfilteredNode: DependenciesTreeNode, filteredNode: DependenciesTreeNode, picked: { nodeSelected: boolean }): void {
    //     // Keep this node if it compiles with all filters or if it is a build node.
    //     picked.nodeSelected =
    //         (this._severitiesFilter.isNodePicked(unfilteredNode) &&
    //             this._licensesFilter.isNodePicked(unfilteredNode) &&
    //             this._scopeFilter.isNodePicked(unfilteredNode)) ||
    //         unfilteredNode instanceof BuildsNode;
    //     for (let unfilteredChild of unfilteredNode.children) {
    //         let filteredNodeChild: DependenciesTreeNode = unfilteredChild.shallowClone();
    //         let childSelected: any = { nodeSelected: false };
    //         this._applyFilters(unfilteredChild, filteredNodeChild, childSelected);
    //         if (childSelected.nodeSelected) {
    //             picked.nodeSelected = true;
    //             filteredNode.addChild(filteredNodeChild);
    //             filteredNodeChild.parent = filteredNode;
    //         }
    //     }
    // }
}