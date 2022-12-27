import { XrayScanProgress } from 'jfrog-client-js';
import * as vscode from 'vscode';
import { LogManager } from '../../log/logManager';

/**
 * Manage the vscode.Progress with steps and substeps if needed
 */
export class StepProgress {
    private static readonly MAX_PROGRESS: number = 99;
    private _totalSteps: number;
    private currentStepMsg?: string;
    private currentStepsDone: number = 0;
    private currentSubstepsCount?: number;

    constructor(
        private _progress: vscode.Progress<{ message?: string; increment?: number }>,
        private _log?: LogManager,
        public onProgress: () => void = () => {
            return;
        },
        totalSteps?: number
    ) {
        this._totalSteps = totalSteps ?? 1;
    }

    public get totalSteps(): number | undefined {
        return this._totalSteps;
    }

    /**
     * Call this method at the beggining of each step.
     * Shows the title of the step and caclulate the needed progress information for the substeps.
     * Calls onProgress method if provided
     * @param msg
     * @param subSteps
     */
    public startStep(msg: string, subSteps?: number) {
        this.currentStepsDone++;
        this.currentStepMsg = msg + (this._totalSteps > 1 ? ' (' + this.currentStepsDone + '/' + this._totalSteps + ')' : '');
        this.currentSubstepsCount = subSteps && subSteps > 0 ? subSteps : undefined;
        this._progress.report({ message: msg });
        if (this.onProgress) {
            this.onProgress();
        }
    }

    /**
     * Get the total amount of progress precentege (45% -> 45) allocated for each step or substep if substeps amount was given on starting the step
     */
    public get getStepIncValue(): number {
        let incPerStep: number = StepProgress.MAX_PROGRESS / this._totalSteps;
        return this.currentSubstepsCount ? incPerStep / this.currentSubstepsCount : incPerStep;
    }

    /**
     * Report progress amount, will update the progress and call onProgress method if provided
     * @param inc - the total amount of progress to increase, default amonut is getStepIncValue
     */
    public reportProgress(inc: number = this.getStepIncValue) {
        if (this.currentStepMsg) {
            this._progress.report({ message: this.currentStepMsg, increment: inc });
            if (this.onProgress) {
                this.onProgress();
            }
        }
    }

    /**
     * Create an XrayScanProgress that is linked to this manager and will report progress
     * @param scanName - the scan name that will be shown in the debug if logManager is provided
     * @returns XrayScanProgress to use in a scan
     */
    public createScanProgress(scanName: string): XrayScanProgress {
        return new (class implements XrayScanProgress {
            private lastPercentage: number = 0;
            constructor(private _progressManager: StepProgress, private _log?: LogManager) {}
            /** @override */
            public setPercentage(percentage: number): void {
                if (percentage != this.lastPercentage) {
                    let inc: number = this._progressManager.getStepIncValue * ((percentage - this.lastPercentage) / 100);
                    this._log?.logMessage(
                        '[' + scanName + '] reported change in progress ' + this.lastPercentage + '% -> ' + percentage + '%',
                        'DEBUG'
                    );
                    this._progressManager.reportProgress(inc);
                }
                this.lastPercentage = percentage;
            }
        })(this, this._log);
    }
}
