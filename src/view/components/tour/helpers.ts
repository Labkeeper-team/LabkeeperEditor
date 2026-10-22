export enum InterfaceTourAnchorClassnames {
    Run = 'run-button',
    AddCode = 'add-code-button-anchor',
    AddMarkdown = 'add-markdown-button-anchor',
    SavePdf = 'save-pdf-button-anchor',
    ResultContainer = 'result-container',
    HistoryCodeIde = 'history-code-ide-anchor',
    CodeSettings = 'code-settings-anchor',
    Problems = 'problems-anchor',
    Ide = 'ide-anchor',
    MobileNavigation = 'mobile-view-switcher-bar__toggle',
    AgentPrompt = 'agent-chat__input',
    AgentFiles = 'agent-files__upload',
    AgentSettings = 'agent-settings__toggle',
    EnterAgentMode = 'viewer-tabs__agent-mode',
    LeaveAgentMode = 'agent-mode-pane__leave',
}

export const getPosition = (anchor: string) => {
    const runButton = document.getElementsByClassName(anchor);
    const rect = runButton.item(0)?.getBoundingClientRect();
    if (
        !rect ||
        !rect.width ||
        !rect.height ||
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth
    ) {
        return {};
    }
    return {
        top: Math.max(
            0,
            Math.min(window.innerHeight - 28, rect.top + rect.height / 2 - 14)
        ),
        left: Math.max(
            0,
            Math.min(window.innerWidth - 28, rect.left + rect.width / 2 - 14)
        ),
    };
};
