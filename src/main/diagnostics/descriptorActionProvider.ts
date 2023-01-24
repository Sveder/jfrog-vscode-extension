import * as vscode from 'vscode';
import { DependencyIssuesTreeNode } from '../treeDataProviders/issuesTree/descriptorTree/dependencyIssuesTreeNode';

import { DescriptorTreeNode } from '../treeDataProviders/issuesTree/descriptorTree/descriptorTreeNode';
import { FileTreeNode } from '../treeDataProviders/issuesTree/fileTreeNode';
import { IssueTreeNode } from '../treeDataProviders/issuesTree/issueTreeNode';
import { DescriptorUtils } from '../treeDataProviders/utils/descriptorUtils';
import { PackageType } from '../types/projectType';
import { Severity, SeverityUtils } from '../types/severity';
import { AbstractFileActionProvider } from './abstractFileActionProvider';

/**
 * Describes the information calculated for a direct dependency with issues in a descriptor
 */
class DirectDependencyInfo {
    constructor(
        public severity: Severity,
        public range: vscode.Range[],
        public diagnosticIssues: Map<string, DirectDependencyIssue> = new Map<string, DirectDependencyIssue>()
    ) {}
}

interface DirectDependencyIssue {
    label: string;
    severity: Severity;
    infectedDependencies: string[];
}

/**
 * Describes an action provider for the descriptor files.
 * 1. Adds diagnostics to the file if it contains issues that was discovered in the scan
 * 2. Adds severity icon to the descriptor file in the places were the infected dependency exists
 */
export class DescriptorActionProvider extends AbstractFileActionProvider implements vscode.CodeActionProvider {
    private _processedMap: Map<vscode.Uri, Map<string, DirectDependencyInfo>> = new Map<vscode.Uri, Map<string, DirectDependencyInfo>>();

    /** @Override */
    public activate(context: vscode.ExtensionContext) {
        super.activate(context);
        context.subscriptions.push(
            this,
            vscode.languages.registerCodeActionsProvider(DescriptorUtils.DESCRIPTOR_SELECTOR, this, {
                providedCodeActionKinds: [vscode.CodeActionKind.Empty]
            } as vscode.CodeActionProviderMetadata)
        );
    }

    /** @Override */
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection): vscode.Command[] | undefined {
        // Search if the file had issues in the scan
        const fileNode: FileTreeNode | undefined = this._treesManager.issuesTreeDataProvider.getFileIssuesTree(document.uri.fsPath);
        if (fileNode instanceof DescriptorTreeNode) {
            // Get the dependency information we created in the specific range in the document
            let processedDependencies: Map<string, DirectDependencyInfo> | undefined = this._processedMap.get(document.uri);
            if (!processedDependencies) {
                return undefined;
            }
            let rangeDependencies: DirectDependencyInfo[] = Array.from(processedDependencies.values()).filter(dependency =>
                dependency.range.some(pos => range.intersection(pos))
            );
            let infectedDependencies: Set<DependencyIssuesTreeNode> = new Set<DependencyIssuesTreeNode>();
            // Get all the infected dependencies for a direct dependency as a set
            for (const directDependencyInfo of rangeDependencies) {
                for (const issueInfo of directDependencyInfo.diagnosticIssues.values()) {
                    for (const infectedDependencyId of issueInfo.infectedDependencies) {
                        let infectedDependency: DependencyIssuesTreeNode | undefined = fileNode.getDependencyByID(infectedDependencyId);
                        if (infectedDependency) {
                            infectedDependencies.add(infectedDependency);
                        }
                    }
                }
            }
            let commands: vscode.Command[] = [];
            // Add jump to tree commands for each infected dependency
            for (const infectedDependency of infectedDependencies) {
                commands.push({
                    command: 'jfrog.issues.select.node',
                    title: "Show infected dependency '" + infectedDependency.componentId + "' in issues tree",
                    arguments: [infectedDependency]
                });
            }
            return commands;
        }

        return undefined;
    }

    /** @Override */
    public async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
        // Search if the descriptor had issues in the scan
        const fileIssues: FileTreeNode | undefined = this._treesManager.issuesTreeDataProvider.getFileIssuesTree(document.uri.fsPath);
        if (fileIssues instanceof DescriptorTreeNode) {
            this._treesManager.logManager.logMessage("Creating diagnostics for descriptor '" + document.uri.fsPath + "'", 'DEBUG');
            const textEditor: vscode.TextEditor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
            let diagnostics: vscode.Diagnostic[] = [];
            let processedDependencies: Map<string, DirectDependencyInfo> = new Map<string, DirectDependencyInfo>();
            // Calculate the direct dependency information of each issue in the descriptor from the impact tree
            fileIssues.dependenciesWithIssue.forEach(dependencyWithIssue => {
                dependencyWithIssue.issues.forEach(issue => {
                    issue.impactedTree.children
                        ?.map(impact => impact.name)
                        .forEach(directDependencyId =>
                            this.handleIssueInDirectDependency(
                                issue,
                                directDependencyId,
                                dependencyWithIssue,
                                dependencyWithIssue.type,
                                processedDependencies,
                                document
                            )
                        );
                });
            });
            for (let directDependencyInfo of processedDependencies.values()) {
                // Add diagnostics to the direct dependency by the order of their severity
                for (const [issueId, info] of Array.from(directDependencyInfo.diagnosticIssues.entries()).sort(
                    (lhs, rhs) => rhs[1].severity - lhs[1].severity
                )) {
                    diagnostics.push(
                        ...this.createDiagnostics(
                            issueId,
                            `${info.label} - Severity: ${SeverityUtils.getString(
                                info.severity
                            )}\nImpacted Components: ${info.infectedDependencies.join()}`,
                            vscode.DiagnosticSeverity.Warning,
                            ...directDependencyInfo.range
                        )
                    );
                }
                // Add gutter icons for top severity of the direct dependency
                this.addGutter(textEditor, SeverityUtils.getIcon(directDependencyInfo.severity), ...directDependencyInfo.range);
            }
            this._diagnosticCollection.set(document.uri, diagnostics);
            this._processedMap.set(document.uri, processedDependencies);
        }
    }

    /**
     * Calculate and update the direct dependency information base on a given issue
     * @param issue - the issue to add to the direct dependency
     * @param directDependencyId - the direct dependency id
     * @param dependencyWithIssue - the dependency with the issue
     * @param packageType  - the direct dependency package type
     * @param processedDependencies - the list of all the processed dependencies to search inside
     * @param document - the document that holds the dependency
     * @returns
     */
    private handleIssueInDirectDependency(
        issue: IssueTreeNode,
        directDependencyId: string,
        dependencyWithIssue: DependencyIssuesTreeNode,
        packageType: PackageType,
        processedDependencies: Map<string, DirectDependencyInfo>,
        document: vscode.TextDocument
    ) {
        // Get/create the information
        let info: DirectDependencyInfo | undefined = this.getOrCreateDirectDependencyInfo(
            directDependencyId,
            packageType,
            processedDependencies,
            document
        );
        if (!info) {
            return;
        }
        // Make sure to calculate top severity from all the issues in the direct dependency
        if (info.severity < issue.severity) {
            info.severity = issue.severity;
        }
        // Add diagnostic for the issue if not exists already from different transitive dependency
        let issueLabel: string = issue.label ? issue.label.toString() : issue.issueId;
        let directDependencyIssue: DirectDependencyIssue | undefined = info.diagnosticIssues.get(issue.issueId);
        if (!directDependencyIssue) {
            info.diagnosticIssues.set(issue.issueId, {
                label: issueLabel,
                severity: issue.severity,
                infectedDependencies: [dependencyWithIssue.componentId]
            } as DirectDependencyIssue);
        } else if (!directDependencyIssue.infectedDependencies.includes(dependencyWithIssue.componentId)) {
            directDependencyIssue.infectedDependencies.push(dependencyWithIssue.componentId);
        }
    }

    /**
     * Get or create if not exists the direct dependency aggregated information
     * @param directDependencyId - the id of the dependency
     * @param packageType - the package type of the dependency
     * @param processedDependencies - the list of all the processed dependencies to search inside
     * @param document - the document that holds the dependency
     * @returns dependency information
     */
    private getOrCreateDirectDependencyInfo(
        directDependencyId: string,
        packageType: PackageType,
        processedDependencies: Map<string, DirectDependencyInfo>,
        document: vscode.TextDocument
    ): DirectDependencyInfo | undefined {
        let potential: DirectDependencyInfo | undefined = processedDependencies.get(directDependencyId);
        if (potential) {
            return potential;
        }
        let range: vscode.Range[] = DescriptorUtils.getDependencyPosition(document, packageType, directDependencyId);
        if (range.length === 0) {
            return undefined;
        }
        let info: DirectDependencyInfo = new DirectDependencyInfo(Severity.NotApplicableUnknown, range);
        processedDependencies.set(directDependencyId, info);
        return info;
    }
}
