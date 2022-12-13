import { IGraphRequestModel, IGraphResponse, XrayScanProgress } from 'jfrog-client-js';
import { ConnectionManager } from '../connect/connectionManager';
import { RootNode } from '../treeDataProviders/dependenciesTree/dependenciesRoot/rootTree';
import { DependenciesTreeNode } from '../treeDataProviders/dependenciesTree/dependenciesTreeNode';
import { Configuration } from '../utils/configuration';

import * as fs from 'fs';
import { Utils } from '../treeDataProviders/utils/utils';

/**
 * Used in Xray >= 3.29.0.
 * Run /scan/graph REST API and populate the cache with the results.
 * When the project key is provided - only violated vulnerabilities should appear in the results. Licenses may mark as violated.
 * When the project key isn't provided - all vulnerabilities and licenses information should appear in the results.
 */
export class GraphScanLogic {
    constructor(protected _connectionManager: ConnectionManager) {}

    public async scan(projectRoot: RootNode, flatten: boolean, progress: XrayScanProgress, checkCanceled: () => void): Promise<IGraphResponse> {
        // Convert DependenciesTreeNode to IGraphRequestModel
        let graphRequest: IGraphRequestModel = {
            component_id: projectRoot.generalInfo.artifactId,
            nodes: flatten ? this.getFlattenRequestModelNodes(projectRoot, new Set<string>) : this.getGraphRequestModelNodes(projectRoot)
        } as IGraphRequestModel;
        let scanPath: string = '/Users/assafa/Documents/request-' + (flatten ? "flatten-" : "") + Utils.getLastSegment(projectRoot.generalInfo.artifactId) + '.json';
        fs.writeFileSync(scanPath, JSON.stringify(graphRequest));
        // Run scan
        return this._connectionManager.scanWithGraph(
            graphRequest,
            progress,
            checkCanceled,
            Configuration.getProjectKey(),
            Configuration.getWatches()
        );
    }

    private getFlattenRequestModelNodes(dependency: DependenciesTreeNode, components: Set<string>): IGraphRequestModel[] {
        let nodes: IGraphRequestModel[] = [];
        for (let child of dependency.children) {
            if(child.dependencyId && !components.has(child.dependencyId)) {
                components.add(child.dependencyId);
                nodes.push({
                    component_id: child.dependencyId,
                    nodes: []
                } as IGraphRequestModel);
            }   
            nodes.push(...this.getFlattenRequestModelNodes(child,components));
        }
        return nodes;
    }

    private getGraphRequestModelNodes(dependency: DependenciesTreeNode): IGraphRequestModel[] {
        let nodes: IGraphRequestModel[] = [];
        if (dependency.children.length > 0) {
            for (let child of dependency.children) {
                nodes.push({
                    component_id: child.dependencyId,
                    nodes: this.getGraphRequestModelNodes(child)
                } as IGraphRequestModel);
            }
        }
        return nodes;
    }
}
