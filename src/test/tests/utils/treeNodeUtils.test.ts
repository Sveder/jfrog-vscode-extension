import { FileTreeNode } from '../../../main/treeDataProviders/issuesTree/fileTreeNode';
import { IssuesRootTreeNode } from '../../../main/treeDataProviders/issuesTree/issuesRootTreeNode';
import { IssueTreeNode } from '../../../main/treeDataProviders/issuesTree/issueTreeNode';
import { Severity } from '../../../main/types/severity';

export interface FileNodeTestCase {
    test: string;
    data: FileNodeTestData;
}

export interface FileNodeTestData {
    path: string;
    issues: Severity[];
}

/**
 * Create file node base on test case
 * @param testCase - the test we want to prepare
 * @returns node prepared base on test case
 */
export function createTestNode(pathOfFile: string): FileTreeNode {
    let fileNode: FileTreeNode = new (class extends FileTreeNode {
        _issues: IssueTreeNode[] = [];
        constructor(fullPath: string, parent?: IssuesRootTreeNode, timeStamp?: number) {
            super(fullPath, parent, timeStamp);
        }
        /** @override */
        public get issues(): IssueTreeNode[] {
            return this._issues;
        }
    })(pathOfFile);
    return fileNode;
}

/**
 * Create file node and populate it with issues base on test case
 * @param testCase - the test we want to prepare
 * @returns node prepared base on test case
 */
export function createAndPopulateTestNode(testCase: FileNodeTestCase): FileTreeNode {
    let fileNode: FileTreeNode = createTestNode(testCase.data.path);
    testCase.data.issues.forEach(issueSeverity => {
        let issue: IssueTreeNode = createDummyIssue(issueSeverity);
        fileNode.issues.push(issue);
    });
    fileNode.apply();
    return fileNode;
}

let issueCounter: number = 0;
/**
 * Create dummy issue node with given severity
 * @param severity - severity that the dummy node will have
 * @returns - dummy issue node
 */
export function createDummyIssue(severity: Severity): IssueTreeNode {
    let issueID: string = '' + issueCounter++;
    return new IssueTreeNode(issueID, severity, issueID);
}
