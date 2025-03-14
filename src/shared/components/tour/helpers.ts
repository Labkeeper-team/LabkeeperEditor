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
}

export const getPosition = (anchor: string) => {
  const runButton = document.getElementsByClassName(anchor);
  const rect = runButton.item(0)?.getBoundingClientRect();
  if (!rect) {
    return {};
  }
  const heightOfHint = 40;
  const widthOfHint = 40;
  return {
    top: rect.top + rect.height / 2 - heightOfHint / 2,
    left: rect.left + rect.width / 2 - widthOfHint / 2,
  };
};
