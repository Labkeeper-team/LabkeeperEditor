import { SegmentType } from '../domain.ts';
import { WikiLinks } from '../../viewModel/wiki.ts';

export interface HeaderHelpItem {
    description: {
        ru: string;
        en: string;
        zh: string;
    };
    segmentType: SegmentType;
    text: {
        ru: string;
        en: string;
        zh: string;
    };
}

export interface EditorHelpItem {
    description: string;
    text: string;
}

export interface LocalizedInstructionItem {
    ru: InstructionItem;
    en: InstructionItem;
    zh: InstructionItem;
}

export interface InstructionItem {
    title: string;
    points: string[];
    image?: string;
    ending?: string;
    wikiLink?: string;
    containsAd?: boolean;
}

export const headerHelpItems: HeaderHelpItem[] = [
    {
        description: {
            ru: 'Массив',
            en: 'Array',
            zh: '数组',
        },
        segmentType: 'computational',
        text: {
            ru: `my_array = [1, 2, 3, 4]`,
            en: `my_array = [1, 2, 3, 4]`,
            zh: `my_array = [1, 2, 3, 4]`,
        },
    },
    {
        description: {
            ru: 'Переменная с погрешностью',
            en: 'Variable with error',
            zh: '带误差的变量',
        },
        segmentType: 'computational',
        text: {
            ru: `my_var = 10 # 1`,
            en: `my_var = 10 # 1`,
            zh: `my_var = 10 # 1`,
        },
    },
    {
        description: {
            ru: 'Нарисовать график',
            en: 'Draw plot',
            zh: '绘制图表',
        },
        segmentType: 'computational',
        text: {
            ru: `plot(
    x1=[1, 2, 3], y1=[2, 3, 1], type1="line", color1="red",
    x2=[1, 2, 3], y2=[3,4,1], type2="scatter", color2="blue"
)`,
            en: `plot(
    x1=[1, 2, 3], y1=[2, 3, 1], type1="line", color1="red",
    x2=[1, 2, 3], y2=[3,4,1], type2="scatter", color2="blue"
)`,
            zh: `plot(
    x1=[1, 2, 3], y1=[2, 3, 1], type1="line", color1="red",
    x2=[1, 2, 3], y2=[3,4,1], type2="scatter", color2="blue"
)`,
        },
    },
    {
        description: {
            ru: 'Нарисовать таблицу',
            en: 'Draw table',
            zh: '绘制表格',
        },
        segmentType: 'computational',
        text: {
            ru: `var_1 = [1, 2, 3]\ntable(var_1, [4, 5, 6], name_2="текст")`,
            en: `var_1 = [1, 2, 3]\ntable(var_1, [4, 5, 6], name_2="text")`,
            zh: `var_1 = [1, 2, 3]\ntable(var_1, [4, 5, 6], name_2="文本")`,
        },
    },
    {
        description: {
            ru: 'Сумма',
            en: 'Sum',
            zh: '求和',
        },
        segmentType: 'computational',
        text: {
            ru: `s = sum([1, 2, 3])`,
            en: `s = sum([1, 2, 3])`,
            zh: `s = sum([1, 2, 3])`,
        },
    },
    {
        description: {
            ru: 'МНК',
            en: 'LSM',
            zh: '最小二乘法',
        },
        segmentType: 'computational',
        text: {
            ru: `x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] # 0.1 // ваши значения
y = [1, 3, 2, 3.5, 2, 3.6, 7, 5, 3, 4] # 0.2 // ваши значения

least_squares(x, y)
a = a # 0 // обнуление погрешности, чтобы график был ровным
b = b # 0
Y = a * x + b

plot(x_1 = x, y_1 = y, color1="blue", x_2 = x, y_2 = Y, color2="red", type2="line")
            `,
            en: `x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] # 0.1 // your x-values
y = [1, 3, 2, 3.5, 2, 3.6, 7, 5, 3, 4] # 0.2 // your y-values

least_squares(x, y)
a = a # 0 // zero error to render correct plot
b = b # 0
Y = a * x + b

plot(x_1 = x, y_1 = y, color1="blue", x_2 = x, y_2 = Y, color2="red", type2="line")
            `,
            zh: `x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] # 0.1 // 你的 x 值
y = [1, 3, 2, 3.5, 2, 3.6, 7, 5, 3, 4] # 0.2 // 你的 y 值

least_squares(x, y)
a = a # 0 // 将误差置零，使直线平滑
b = b # 0
Y = a * x + b

plot(x_1 = x, y_1 = y, color1="blue", x_2 = x, y_2 = Y, color2="red", type2="line")
            `,
        },
    },
    {
        description: {
            ru: 'Формула',
            en: 'Formula',
            zh: '公式',
        },
        segmentType: 'md',
        text: {
            ru: '$$\n\\int f(x) dx = F(x)\n$$',
            en: '$$\n\\int f(x) dx = F(x)\n$$',
            zh: '$$\n\\int f(x) dx = F(x)\n$$',
        },
    },
    {
        description: {
            ru: 'Строчная формула',
            en: 'Inline formula',
            zh: '行内公式',
        },
        segmentType: 'md',
        text: {
            ru: 'Формула с интегралом: $\\int f(x) dx = F(x)$',
            en: 'My formula with integral: $\\int f(x) dx = F(x)$',
            zh: '含积分的公式：$\\int f(x) dx = F(x)$',
        },
    },
    {
        description: {
            ru: 'Загрузить csv',
            en: 'Load csv',
            zh: '加载 csv',
        },
        segmentType: 'computational',
        text: {
            ru: `// Добавьте файл с таким названием через файловый менеджер
load_csv(file_name = "myfile.csv")
            `,
            en: `// Add file with such via file manager
load_csv(file_name = "myfile.csv")
            `,
            zh: `// 请通过文件管理器添加同名文件
load_csv(file_name = "myfile.csv")
            `,
        },
    },
    {
        description: {
            ru: 'Сохранить csv',
            en: 'Save csv',
            zh: '保存 csv',
        },
        segmentType: 'computational',
        text: {
            ru: `a = [1, 2, 3] // ваши данные
save_csv(a)
            `,
            en: `a = [1, 2, 3] // your data
save_csv(a)
            `,
            zh: `a = [1, 2, 3] // 你的数据
save_csv(a)
            `,
        },
    },
];

export const editorHelpItems: EditorHelpItem[] = [
    {
        description: 'Array',
        text: 'a = [1, 2, 3, 4, 5]',
    },
    {
        description: 'Variable with error',
        text: 'a = 10 # 1',
    },
    {
        description: 'Array with error',
        text: 'a = [1, 2, 3] # 0.5',
    },
    {
        description: 'Array from range',
        text: 'a = range(from = 1, to = 10, step = 1)',
    },
    {
        description: 'Plot',
        text: `plot(
    x1 = [1, 2, 3], y1 = [2, 1, 3], type1="line", x2=[1, 2, 3], y2=[3, 4, 5]
)`,
    },
    {
        description: 'Table',
        text: 'table([1, 2, 3], [4, 5, 6])',
    },
    {
        description: 'Save csv',
        text: 'save_csv([1, 2, 3])',
    },
    {
        description: 'Load csv',
        text: 'load_csv(file_name = "default.csv")',
    },
];

const basicEndingRu = 'Больше информации доступно на';
const basicEndingEn = 'More information on';
const basicEndingZh = '更多信息请参见';

export const agentModeInstructions: LocalizedInstructionItem[] = [
    {
        ru: {
            title: 'Агентский режим',
            points: [
                'Опишите в чате, какой документ нужен, и отправьте сообщение.',
                'Агент сам пишет и правит документ. Код набирать не нужно.',
                'Если хотите редактировать сам документ вручную, нажмите кнопку перехода в полный редактор.',
            ],
            image: '/instructions/agent_mode.svg',
        },
        en: {
            title: 'Agent mode',
            points: [
                'Describe the document you need in the chat and send the message.',
                'The agent writes and edits the document. You do not type the code.',
                'To edit the document by hand, press the button that opens the full editor.',
            ],
            image: '/instructions/agent_mode.svg',
        },
        zh: {
            title: '智能体模式',
            points: [
                '在聊天中描述你需要的文档并发送消息。',
                '智能体会自行编写和修改文档，你无需输入代码。',
                '如需手动编辑文档，请点击进入完整编辑器的按钮。',
            ],
            image: '/instructions/agent_mode.svg',
        },
    },
];

export const instructions: LocalizedInstructionItem[] = [
    {
        ru: {
            title: 'Создайте ваш первый документ',
            points: [
                'Добавьте сегмент: Markdown, LaTeX или «Вычисление» — и напишите текст, формулу или расчёт.',
                'Или опишите документ ИИ-агенту: он напишет проект сам.',
                'Нажмите «Выполнить»: справа появится результат, его можно сохранить в PDF.',
            ],
            image: '/instructions/welcome.png',
            ending: basicEndingRu,
            containsAd: true,
            wikiLink: WikiLinks.home,
        },
        en: {
            title: 'Create your first document',
            points: [
                'Add a Markdown, LaTeX, or Computation segment and write text, a formula, or a calculation.',
                'Or describe the document to the AI agent: it will write the project for you.',
                'Press Run: the result appears on the right and can be saved as a PDF.',
            ],
            ending: basicEndingEn,
            wikiLink: WikiLinks.home,
            image: '/instructions/welcome.png',
        },
        zh: {
            title: '创建你的第一个文档',
            points: [
                '添加 Markdown、LaTeX 或“计算”片段，并输入文本、公式或计算。',
                '或者向 AI 智能体描述文档：它会为你编写项目。',
                '点击“运行”：结果会显示在右侧，并可保存为 PDF。',
            ],
            ending: basicEndingZh,
            wikiLink: WikiLinks.home,
            image: '/instructions/welcome.png',
        },
    },
    agentModeInstructions[0],
    {
        ru: {
            title: 'LaTeX',
            points: [
                'Полная поддержка LaTeX с помощью texlive',
                'Если в вашем тексте нет оператора ```\\begin{document}```, он будет добавлен автоматически вместе со стандартной конфигурацией в начале документа',
                'Если в вашем тексте нет оператора ```\\end{document}```, он будет добавлен автоматически в конце документа',
            ],
            image: '/instructions/latex_hint.png',
        },
        en: {
            title: 'LaTeX',
            points: [
                'Full LaTeX support',
                'If your text does not contain the ```\\begin{document}``` operator, it will be added automatically with standard configuration at the beginning of the document',
                'If your text does not contain the ```\\end{document}``` operator, it will be added automatically at the end of the document',
            ],
            image: '/instructions/latex_hint.png',
        },
        zh: {
            title: 'LaTeX',
            points: [
                '基于 texlive 的完整 LaTeX 支持',
                '如果文本中没有 ```\\begin{document}```，它会连同标准配置一起自动添加到文档开头',
                '如果文本中没有 ```\\end{document}```，它会自动添加到文档末尾',
            ],
            image: '/instructions/latex_hint.png',
        },
    },
    {
        ru: {
            title: 'Markdown',
            points: [
                'Заголовки, списки, таблицы и ссылки рисуются сразу в браузере, без кнопки «Выполнить».',
                'Формулы пишутся как в LaTeX: ```$...$``` в строке и ```$$...$$``` отдельным блоком.',
                'В текст можно вставлять HTML: он тоже рисуется.',
            ],
            image: '/instructions/quick_start.png',
            ending: basicEndingRu,
            wikiLink: WikiLinks.examples,
        },
        en: {
            title: 'Markdown',
            points: [
                'Headings, lists, tables, and links render in the browser. The Run button is not needed.',
                'Formulas use LaTeX syntax: ```$...$``` inline and ```$$...$$``` as a block.',
                'HTML in the text is rendered too.',
            ],
            ending: basicEndingEn,
            wikiLink: WikiLinks.examples,
            image: '/instructions/quick_start.png',
        },
        zh: {
            title: 'Markdown',
            points: [
                '标题、列表、表格和链接会直接在浏览器中渲染，无需点击“运行”。',
                '公式使用 LaTeX 语法：行内用 ```$...$```，独立块用 ```$$...$$```。',
                '文本中的 HTML 也会被渲染。',
            ],
            ending: basicEndingZh,
            wikiLink: WikiLinks.examples,
            image: '/instructions/quick_start.png',
        },
    },
    {
        ru: {
            title: 'Вставка результатов вычислений',
            points: [
                'Создайте вычислительный и markdown сегменты',
                'Добавьте переменную и воспользуйтесь оператором ${}',
                'Нажмите кнопку Выполнить',
            ],
            image: '/instructions/md_insert.png',
            ending: basicEndingRu,
            wikiLink: WikiLinks.valueSubstitution,
        },
        en: {
            title: 'Insert computation result into text',
            points: [
                'Create computational and markdown segments',
                'Add new variable and use operator ${} to reference it',
                'Press the run button',
            ],
            image: '/instructions/md_insert.png',
            ending: basicEndingEn,
            wikiLink: WikiLinks.valueSubstitution,
        },
        zh: {
            title: '在文本中插入计算结果',
            points: [
                '创建计算片段和 Markdown 片段',
                '添加变量，并用 ${} 运算符引用它',
                '点击“运行”按钮',
            ],
            image: '/instructions/md_insert.png',
            ending: basicEndingZh,
            wikiLink: WikiLinks.valueSubstitution,
        },
    },
    {
        ru: {
            title: 'Вставка картинок',
            points: [
                'Загрузите картинку в буфер обмена (можно нажать CTRL+C на файле, либо копировать картинку в браузере)',
                'Создайте markdown сегмент и нажмите CTRL+V',
                'Нажмите кнопку Выполнить',
            ],
            image: '/instructions/image_insert.png',
            ending: basicEndingRu,
            wikiLink: WikiLinks.segments,
        },
        en: {
            title: 'Add an image',
            points: [
                'Load image into clipboard (use CTRL+C on image file, or click copy image in browser)',
                'Create markdown segment and click CTRL+V',
                'Press the run button',
            ],
            image: '/instructions/image_insert.png',
            ending: basicEndingEn,
            wikiLink: WikiLinks.segments,
        },
        zh: {
            title: '插入图片',
            points: [
                '将图片复制到剪贴板（在文件上按 CTRL+C，或在浏览器中复制图片）',
                '创建 Markdown 片段并按 CTRL+V',
                '点击“运行”按钮',
            ],
            image: '/instructions/image_insert.png',
            ending: basicEndingZh,
            wikiLink: WikiLinks.segments,
        },
    },
    {
        ru: {
            title: 'Использование простых формул',
            points: [
                'Создайте сегмент с простой формулой',
                'Напишите какую-нибудь математику в упрощенном формате (без тегов)',
                'Нажмите кнопку Выполнить',
            ],
            image: '/instructions/simple_formula.png',
            ending: basicEndingRu,
            wikiLink: WikiLinks.mathRenderingExamples,
        },
        en: {
            title: 'Simple formulas segment usage',
            points: [
                'Create a simple formula segment',
                'Write some math in simplified way (without latex tags)',
                'Press the run button',
            ],
            image: '/instructions/simple_formula.png',
            ending: basicEndingEn,
            wikiLink: WikiLinks.mathRenderingExamples,
        },
        zh: {
            title: '使用简易公式片段',
            points: [
                '创建一个简易公式片段',
                '用简化格式（无需 LaTeX 标签）书写数学表达式',
                '点击“运行”按钮',
            ],
            image: '/instructions/simple_formula.png',
            ending: basicEndingZh,
            wikiLink: WikiLinks.mathRenderingExamples,
        },
    },
    {
        ru: {
            title: 'Погрешности',
            points: [
                `
                Для любой сложной формулы автоматически вычисляется сложная
                погрешность на основе погрешностей входящих в нее переменных`,
                'Изначально у любой переменной погрешность 0',
                'Все вычисления погрешности рисуются автоматически. В настройках сегмента отображение можно выключить',
            ],
            image: '/instructions/error.png',
            ending: basicEndingRu,
            wikiLink: WikiLinks.errorOperator,
        },
        en: {
            title: 'Errors',
            points: [
                `For any complex formula, an error is automatically calculated.
                This error is based on the errors of the variables included in it`,
                'By default, any variable has an error of 0',
                'All error calculations are drawn automatically. You can turn off the display in the segment settings.',
            ],
            image: '/instructions/error.png',
            ending: basicEndingEn,
            wikiLink: WikiLinks.errorOperator,
        },
        zh: {
            title: '误差',
            points: [
                '任何复杂公式的误差都会根据其中各变量的误差自动计算',
                '默认情况下，所有变量的误差为 0',
                '所有误差计算过程都会自动显示，可在片段设置中关闭显示',
            ],
            image: '/instructions/error.png',
            ending: basicEndingZh,
            wikiLink: WikiLinks.errorOperator,
        },
    },
    {
        ru: {
            title: 'Рисование графиков',
            points: [
                'Создайте вычислительный сегмент и используйте функцию plot',
                'Нажмите кнопку Выполнить',
                'В функции plot можно рисовать несколько кривых, указывать их тип и цвет: plot(x1=, y1=, x2=, y2=, type1="line")',
            ],
            image: '/instructions/draw_plot.png',
            ending: basicEndingRu,
            wikiLink: WikiLinks.plot,
        },
        en: {
            title: 'Drawing plots',
            points: [
                'Create computation segment and user plot function',
                'Click the run button',
                'You can specify curves count, color, type and other in plot function: plot(x1=, y1=, x2=, y2=, type1="line")',
            ],
            image: '/instructions/draw_plot.png',
            ending: basicEndingEn,
            wikiLink: WikiLinks.plot,
        },
        zh: {
            title: '绘制图表',
            points: [
                '创建计算片段并使用 plot 函数',
                '点击“运行”按钮',
                'plot 函数可以绘制多条曲线，并指定类型和颜色：plot(x1=, y1=, x2=, y2=, type1="line")',
            ],
            image: '/instructions/draw_plot.png',
            ending: basicEndingZh,
            wikiLink: WikiLinks.plot,
        },
    },
    {
        ru: {
            title: 'Печать в pdf',
            points: [
                'Создайте несколько сегментов',
                'Нажмите кнопку Выполнить',
                'Нажмите кнопку Печать в pdf, далее вы сможете сохранить получившийся файл',
                'Важно! Обязательно выбирайте пункт "сохранить как PDF", иначе символы нельзя будет выделить',
            ],
            image: '/instructions/print_pdf.png',
            ending: basicEndingRu,
            wikiLink: WikiLinks.home,
        },
        en: {
            title: 'Print to pdf',
            points: [
                'Create some segments',
                'Press the run button',
                'Press Print to pdf button, then you can save pdf as a file',
                'Warning! You may use "Save as PDF" option, otherwise symbols will not be selected',
            ],
            image: '/instructions/print_pdf.png',
            ending: basicEndingEn,
            wikiLink: WikiLinks.home,
        },
        zh: {
            title: '打印为 PDF',
            points: [
                '创建几个片段',
                '点击“运行”按钮',
                '点击“打印为 PDF”按钮，然后即可保存生成的文件',
                '注意！请务必选择“另存为 PDF”，否则文字将无法选中',
            ],
            image: '/instructions/print_pdf.png',
            ending: basicEndingZh,
            wikiLink: WikiLinks.home,
        },
    },
];
