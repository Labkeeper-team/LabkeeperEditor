import AsciiMathParser from 'asciimath2tex';

export const parser = new AsciiMathParser();

export const MAX_LINE_LENGTH = 60
export const VAR_MAX_LENGTH_BEFORE_RESETING_TO_NEW_LINE = 30
export const MAX_LINE_LENGTH_BEFORE_SETTING_INFL_TO_NEW_LINE = MAX_LINE_LENGTH * 5 / 4
export const MAX_INFL_LENGTH_TO_DISPLAY_ON_SAME_LINE = 20
export const MAX_LENGTH_VAR = 2;
export const MAX_LINE_COUNT_IN_ARRAY = 20
export const LINE_LENGTH_WHEN_FORMULA_IS_SHRINK = 10 * MAX_LINE_LENGTH

export function renderArrayWithoutInflToLatex(array) {
  const clearFormulaItems = array
    .map((i) => parser.parse(i.infl))

  let currentLineLength = 0;
  let arrayPresentation = ''
  let lineCount = 0
  let stopped = false
  const addStringPresentation = (str) => {
    if (stopped) {
      return
    }
    if (currentLineLength + str.length > MAX_LINE_LENGTH && currentLineLength > 0) {
      arrayPresentation += '\\\\ ';
      currentLineLength = 0;
      lineCount ++;
    }
    if (lineCount >= MAX_LINE_COUNT_IN_ARRAY) {
      arrayPresentation += '...'
      stopped = true
      return
    }

    if (str.length > MAX_LINE_LENGTH) {
      arrayPresentation += '\\scriptstyle';
    }
    arrayPresentation += str;
    currentLineLength += str.length;

    if (currentLineLength > MAX_LINE_LENGTH) {
      currentLineLength = 0;
      arrayPresentation += '\\\\';
      lineCount += 1;
    }
  }
  clearFormulaItems
    .forEach((formula, index) => {
      const comma = index + 1 < clearFormulaItems.length && clearFormulaItems.length > 1 ? ',\\ ' : ""
      const parsedFormula = parser.parse(formula);
      addStringPresentation(`${parsedFormula}${comma}`)
  })

  return `${clearFormulaItems.length > 1 ? '\\left[' : ''}
        \\begin{array}{c}
        ${arrayPresentation}
        \\end{array}
       ${clearFormulaItems.length > 1 ? '\\right]' : ''}`
}

export function renderArrayWithInflToLatex(array, initialGap) {
  let arrayPresentation = ''
  let maxLineLength = 0
  let lineCount = 0
  let stopped = false
  const addStringPresentation = (str) => {
    if (stopped) {
      return
    }
    if (currentLineLength + str.length > MAX_LINE_LENGTH && currentLineLength > 0) {
      arrayPresentation += '\\\\ ';
      currentLineLength = 0;
      lineCount++
    }
    if (lineCount >= MAX_LINE_COUNT_IN_ARRAY) {
      arrayPresentation += '...'
      stopped = true
      return
    }

    if (str.length > MAX_LINE_LENGTH) {
      arrayPresentation += '\\scriptstyle';
    }
    arrayPresentation += str;
    currentLineLength += str.length;
    maxLineLength = Math.max(maxLineLength, currentLineLength)

    if (currentLineLength > MAX_LINE_LENGTH) {
      currentLineLength = 0;
      arrayPresentation += '\\\\';
      lineCount++
    }
  }

  const isArray = array.length > 1;
  const hasSingleInflValue = array
    .map(item => item.infl)
    .filter((value, index, array) => array.indexOf(value) === index)
    .length === 1 && isArray
  let currentLineLength = 0;
  array.forEach((item, index) => {
    const {value, infl} = item

    const valueParsedString = parser.parse(value);
    const inflParsedString = parser.parse(infl);
    const inflFloatValue = parseFloat(infl);
    const comma = index + 1 < array.length ? ',\\ ' : '';

    if (inflFloatValue && !hasSingleInflValue) {
      addStringPresentation(valueParsedString);
      addStringPresentation(`\\pm ${inflParsedString}${comma}`);
    } else {
      addStringPresentation(`${valueParsedString}${comma}`);
    }
  })

  const singleInflString = hasSingleInflValue ? parser.parse(array[0].infl) : ''
  const displaySingleInflOnSameLine = maxLineLength < MAX_LINE_LENGTH_BEFORE_SETTING_INFL_TO_NEW_LINE && singleInflString.length < MAX_INFL_LENGTH_TO_DISPLAY_ON_SAME_LINE;
  const resetValuesToNewLine = initialGap > VAR_MAX_LENGTH_BEFORE_RESETING_TO_NEW_LINE
  const displaySingleInfl = hasSingleInflValue && parseFloat(parser.parse(array[0].infl))

  return `${resetValuesToNewLine ? '\\end{equation}\\begin{equation}\\displaystyle \\ =' : ''}
    ${isArray ? '\\left[' : ''}
    \\begin{array}{c}
        ${arrayPresentation}
    \\end{array}
    \\displaystyle
    ${isArray ? '\\right]' : ''}
    ${(displaySingleInfl && displaySingleInflOnSameLine) ? `\\pm ${singleInflString}` : ''}
    ${(displaySingleInfl && !displaySingleInflOnSameLine) ? `\\end{equation}\\begin{equation}\\displaystyle\\pm ${singleInflString}` : ''}`
}

export function renderArrayOfValuedFormulasToLatex(formulas, initialGap, maySplit=false) {
  const isCutted = formulas.length > 5
  const formulasCutted = isCutted ? [formulas[0], formulas[1], formulas[2], formulas[3], formulas[4]] : formulas

  let arrayPresentation = ''
  let maxLineLength = 0
  const addStringPresentation = (str, asciiStringLength) => {
    if (currentLineLength + asciiStringLength > MAX_LINE_LENGTH && currentLineLength > 0) {
      arrayPresentation += '\\\\ ';
      currentLineLength = 0;
    }

    if (asciiStringLength > MAX_LINE_LENGTH) {
      arrayPresentation += '\\scriptscriptstyle';
    }
    arrayPresentation += str;
    currentLineLength += asciiStringLength;
    maxLineLength = Math.max(maxLineLength, currentLineLength)

    if (currentLineLength > MAX_LINE_LENGTH) {
      currentLineLength = 0;
      arrayPresentation += '\\\\';
    }
  }

  const isArray = formulasCutted.length > 1;
  let currentLineLength = 0;
  formulasCutted.forEach((formula, index) => {
    let parsedFormula = parser.parse(formula);
    if (maySplit) {
      parsedFormula = tryToSplitFormulaByPlusesInSqrt(parsedFormula)
    }
    const comma = index + 1 < formulasCutted.length ? ',\\ ' : '';

    addStringPresentation(`${parsedFormula}${comma}`, formula.length);
  })

  if (isCutted) {
    addStringPresentation('...', MAX_LINE_LENGTH)
  }

  const resetValuesToNewLine = initialGap > VAR_MAX_LENGTH_BEFORE_RESETING_TO_NEW_LINE

  return `${resetValuesToNewLine ? '\\end{equation}\\begin{equation}\\displaystyle \\ =' : ''}
    ${isArray ? '\\left[' : ''}
    \\begin{array}{c}
        ${arrayPresentation}
    \\end{array}
    ${isArray ? '\\right]' : ''}
    \\displaystyle
    `
}

export function renderVariableToLatex(name) {
  const [first, second, third] = name.split('_')
  if (!first) {
    return second;
  }

  const tryParseToText = v => isAlphabetic(v) ? `\\${v}` : (v.length > MAX_LENGTH_VAR
    ? v.replace(v, `\\text{${v.replace(/_/g, '-')}}`)
    : v);

  if (second && !third) {
    return `${tryParseToText(first)}_{${tryParseToText(second)}}`;
  }

  return tryParseToText(name)
}

function isAlphabetic(s: string) {
  switch (s) {
    case 'alpha': return true
    case 'beta': return true
    case 'gamma': return true
    case 'delta': return true
    case 'epsilon': return true
    case 'zeta': return true
    case 'eta': return true
    case 'theta': return true
    case 'iota': return true
    case 'kappa': return true
    case 'lambda': return true
    case 'lamda': return true
    case 'mu': return true
    case 'nu': return true
    case 'xi': return true
    case 'omicron': return true
    case 'pi': return true
    case 'rho': return true
    case 'sigma': return true
    case 'tau': return true
    case 'upsilon': return true
    case 'phi': return true
    case 'chi': return true
    case 'psi': return true
    case 'omega': return true
    default: return false
  }
}

export function renderFormulaToLatex(str, variables, maySplitBySqrt=false) {
  let aliased_equation = str
  variables.forEach((v) => {
    const presentation = renderVariableToLatex(v)
    const sigma = `sigma(${v})`
    aliased_equation = aliased_equation.replaceAll(sigma, `\\text{${toAlias(sigma)}}`)
    if (v !== presentation) {
      aliased_equation = aliased_equation.replaceAll(v, `\\text{${toAlias(v)}}`)
    }
  })

  let parsed_equation = parser.parse(aliased_equation)

  variables.forEach((v) => {
    const presentation = renderVariableToLatex(v)
    const sigma = `sigma(${v})`

    parsed_equation = parsed_equation.replaceAll(`\\text{${toAlias(sigma)}}`, `\\sigma(${presentation})`)
    if (v !== presentation) {
      parsed_equation = parsed_equation.replaceAll(`\\text{${toAlias(v)}}`, presentation)
    }
  })

  let style = '\\displaystyle'

  if (str.length > MAX_LINE_LENGTH) {
    if (maySplitBySqrt) {
      parsed_equation = tryToSplitFormulaByPlusesInSqrt(parsed_equation)
      if (str.length > LINE_LENGTH_WHEN_FORMULA_IS_SHRINK) {
        style = '\\scriptscriptstyle'
      }
    } else {
      style = '\\scriptscriptstyle'
    }
  }

  return `
  ${style}
  ${parsed_equation}
  \\displaystyle
  `
}

function toAlias(str) {
  let result = "biba"
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(97 + str.charCodeAt(i) % 26);
  }
  return result;
}

function tryToSplitFormulaByPlusesInSqrt(formula) {
  if (!formula.startsWith('\\sqrt{') || !formula.endsWith('}')) {
    return formula
  }
  const formulaWithoutSqrt = formula.substring('\\sqrt{'.length, formula.length - 1)

  const divs = [""]
  let bracesCount = 0
  for (let i = 0; i < formulaWithoutSqrt.length; i++) {
    const c = formulaWithoutSqrt[i]

    if (c === '(' || c === '{') {
      bracesCount++
    }
    if (c === ')' || c === '}') {
      bracesCount--
    }

    if (c === '+' && bracesCount === 0) {
      divs.push("")
      continue
    }

    divs[divs.length - 1] += c
  }

  const resultDivs = [[]] as string[][]
  let currentLength = 0
  for (let i = 0; i < divs.length; i++) {
    resultDivs[resultDivs.length - 1].push(divs[i])
    currentLength += divs[i].length

    if (currentLength > MAX_LINE_LENGTH) {
      resultDivs.push([])
      currentLength = 0
    }
  }

  const result = resultDivs.filter(item => item.length > 0).map(array => array.join('+')).join('+ \\\\')
  return `\\sqrt{
  \\begin{array}{l}
  ${result}
  \\end{array}
  }`
}