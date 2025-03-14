export const getPosition = (anchor: string) => {
  const runButton = document.getElementsByClassName(anchor);
  const rect = runButton.item(0)?.getBoundingClientRect();
  if (!rect) {
    return {};
  }

  const additionalHeight = rect.height > 60 ? rect.height / 2 : 5;
  return { top: rect.top + additionalHeight, left: rect.left + rect.width / 2 };
};
