import { Page, Route } from '@playwright/test';
import {
    CompileErrorResult,
    Program,
    Segment,
    Statement,
} from '../../model/domain.ts';

// Типы для заглушек

type BodyTypeForGetAndDefaultRequest =
    | 'default'
    | 'withTwoSegmentsBibaAndAEqualTen'
    | 'withSegmentBiba'
    | 'empty';

type BodyTypeForProjectCompileRequest =
    | 'defaultMd'
    | 'longExampleWithTableAndPlot'
    | 'status203'
    | 'empty';

type BodyTypeForFileListRequest = 'default' | 'emptyFiles' | 'empty';

type BodyTypeForSaveProgramRequest = 'default' | 'empty';

type BodyTypeForCompileRequest =
    | 'errorBody'
    | 'empty'
    | 'mdTypeBody'
    | 'computationalTypeBody';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const version = 'v2';
const contentType = 'application/json';
const defaultUserId = 1;
const anotherUserId = 2;
const defaultId = 1;
const defaultEmail = 'a@gmail.com';
const defaultIsAuthenticated = true;

export class RouteSetup {
    constructor(private page: Page) {}

    // Перехватываем запрос user-info
    async setupGetUserInfoRequest(
        isAuthenticated: boolean = defaultIsAuthenticated,
        email: string = defaultEmail,
        id: number = defaultId
    ) {
        await this.page.route(
            `/api/${version}/public/user-info`,
            async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: contentType,
                    body: JSON.stringify({
                        isAuthenticated: isAuthenticated,
                        email: email,
                        id: id,
                    }),
                });
            }
        );
    }

    async setupLlmPrompt(code: number) {
        await this.page.route(
            `/api/${version}/public/project/${uuid}/prompt?prompt=biba`,
            async (route) => {
                await route.fulfill({
                    status: code,
                    contentType: contentType,
                    body: JSON.stringify({
                        segments: [
                            {
                                type: 'md',
                                text: 'LLM GENERATED',
                                parameters: { visible: true },
                            },
                        ],
                        parameters: { roundStrategy: 'firstMeaningDigit' },
                    } as Program),
                });
            }
        );
    }

    //вспомогательная функция для default project и project get
    private getProjectBodyForGetAndDefault(
        typeBody: BodyTypeForGetAndDefaultRequest
    ) {
        if (typeBody == 'withTwoSegmentsBibaAndAEqualTen') {
            return {
                projectId: uuid,
                userId: anotherUserId,
                isPublic: true,
                title: 'Default Project',
                lastModified: new Date().toISOString(),
                program: {
                    segments: [
                        {
                            id: 1,
                            type: 'md',
                            parameters: {
                                visible: true,
                            },
                            text: '# biba\n\n',
                        },
                        {
                            id: 2,
                            type: 'computational',
                            parameters: {
                                visible: true,
                            },
                            text: 'a = 10\n\n',
                        },
                    ],
                    parameters: {
                        roundStrategy: 'noRound',
                    },
                },
            };
        } else if (typeBody == 'default') {
            return {
                projectId: uuid,
                userId: defaultUserId,
                title: 'Default Project',
                lastModified: new Date().toISOString(),
                program: {
                    segments: [],
                    parameters: {
                        roundStrategy: 'noRound',
                    },
                },
            };
        } else if (typeBody == 'empty') {
            return {};
        } else {
            return {
                projectId: uuid,
                userId: anotherUserId,
                title: 'Default Project',
                lastModified: new Date().toISOString(),
                isPublic: true,
                program: {
                    segments: [
                        {
                            type: 'md',
                            text: '# Biba',
                            parameters: { visible: true },
                        } as Segment,
                    ],
                    parameters: {
                        roundStrategy: 'noRound',
                    },
                },
            };
        }
    }

    async setupGetProjectRequest(
        status: number = 200,
        bodyType: BodyTypeForGetAndDefaultRequest = 'default'
    ) {
        await this.page.route(
            `/api/${version}/public/project/${uuid}/get`,
            async (route) => {
                await route.fulfill({
                    status: status,
                    contentType: contentType,
                    body: JSON.stringify(
                        this.getProjectBodyForGetAndDefault(bodyType)
                    ),
                });
            }
        );
    }

    async setupGetDefaultProjectRequest(
        status: number = 200,
        bodyType: BodyTypeForGetAndDefaultRequest = 'default',
        onRoute?: () => void
    ) {
        await this.page.route(
            `/api/${version}/public/project/default`,
            async (route) => {
                if (onRoute) {
                    onRoute();
                }
                await route.fulfill({
                    status: status,
                    contentType: contentType,
                    body: JSON.stringify(
                        this.getProjectBodyForGetAndDefault(bodyType)
                    ),
                });
            }
        );
    }

    //вспомогательная функция для project compile
    private getProjectBodyForProjectCompile(
        typeBody: BodyTypeForProjectCompileRequest,
        countStatements?: number,
        textMd?: string,
        code?: number
    ) {
        if (typeBody == 'longExampleWithTableAndPlot') {
            const statements = [
                {
                    type: 'latex',
                    legendVisible: false,
                    latex: '\\begin{equation}\n\\normalsize\na\n\\ = \\\n\\text{range} \\left ( 10 \\right )\n\\ = \\\n\\left[\n\\begin{array}{c}\n\\normalsize\n0\n, \\ \n1\n, \\ \n2\n, \\ \n3\n, \\ \n4\n, \\ \n5\n, \\ \n6\n, \\ \n7\n, \\ \n8\n, \\ \n9\n\\end{array}\n\\right]\n\\end{equation}\n',
                },
                {
                    type: 'latex',
                    legendVisible: false,
                    latex: '\\begin{equation}\n\\normalsize\nb\n\\ = \\\na^{2}\n\\ = \\\n\\left[\n\\begin{array}{c}\n\\normalsize\n0^{2}\n, \\ \n1^{2}\n, \\ \n2^{2}\n\\\\\n\\normalsize\n...\n\\end{array}\n\\right]\n\\ = \\\n\\left[\n\\begin{array}{c}\n\\normalsize\n0\n, \\ \n1\n, \\ \n4\n, \\ \n9\n, \\ \n16\n, \\ \n25\n, \\ \n36\n, \\ \n49\n, \\ \n64\n, \\ \n81\n\\end{array}\n\\right]\n\\end{equation}\n',
                },
                {
                    type: 'table',
                    items: [['a', '0', '1', '2', '3', '4', '5', '6', '7', '8']],
                    legendVisible: false,
                },
                {
                    type: 'plot',
                    plotName: 'Plot',
                    plotXAxisName: 'x',
                    plotYAxisName: 'y',
                    plots: [
                        {
                            x: [
                                '0',
                                '1',
                                '2',
                                '3',
                                '4',
                                '5',
                                '6',
                                '7',
                                '8',
                                '9',
                            ],
                            y: [
                                '0',
                                '1',
                                '2',
                                '3',
                                '4',
                                '5',
                                '6',
                                '7',
                                '8',
                                '9',
                            ],
                            name: 'plot',
                            type: 'scatter',
                            color: 'blue',
                            xInfl: [],
                            yInfl: [],
                        },
                    ],
                    legendVisible: false,
                },
            ];
            if (countStatements == 3) {
                statements.splice(1, 1);
            }
            return {
                segments: [
                    {
                        id: 1,
                        type: 'computational',
                        statements: statements,
                    },
                ],
            };
        } else if (typeBody == 'defaultMd') {
            return {
                segments: [
                    {
                        id: 1,
                        type: 'md',
                        statements: null,
                        text: textMd,
                    },
                ],
            };
        } else if (typeBody == 'status203') {
            return {
                errors: [
                    {
                        code: code,
                        payload: {
                            segmentId: 1,
                            line: 2,
                            variable: null,
                            operators: null,
                            quotaIndex: 0,
                            value: null,
                            limit: null,
                            position: 0,
                        },
                    },
                ],
            };
        } else {
            return {};
        }
    }

    async setupCompileProjectRequest(
        status: number,
        bodyType: BodyTypeForProjectCompileRequest,
        countStatements?: number,
        textMd?: string,
        code?: number,
        onRoute?: () => void
    ) {
        await this.page.route(
            `/api/${version}/public/project/${uuid}/compile`,
            async (route) => {
                if (onRoute) {
                    onRoute();
                }
                await route.fulfill({
                    status: status,
                    contentType: contentType,
                    body: JSON.stringify(
                        this.getProjectBodyForProjectCompile(
                            bodyType,
                            countStatements,
                            textMd,
                            code
                        )
                    ),
                });
            }
        );
    }

    async setupCompileProjectPdfRequest(status: number) {
        await this.page.route(
            `/api/${version}/public/project/${uuid}/compile/pdf`,
            async (route) => {
                await route.fulfill({
                    status,
                    contentType: contentType,
                    body: JSON.stringify({}),
                });
            }
        );
    }

    //вспомогательная функция для file list
    private getProjectBodyForFileList(
        typeBody: BodyTypeForFileListRequest,
        fileName?: string
    ) {
        if (typeBody == 'default') {
            return {
                files: [
                    {
                        autogenerated: false,
                        fileName: fileName,
                        url: '/files/example.txt',
                    },
                ],
            };
        } else if (typeBody == 'empty') {
            return {};
        } else if (typeBody == 'emptyFiles') {
            return { files: [] };
        }
    }

    // Перехватываем запрос на список файлов
    async setupListFilesRequest(
        status: number = 200,
        bodyType: BodyTypeForFileListRequest = 'default',
        getIsAfterCompilation?: () => boolean,
        onRoute?: () => void
    ) {
        let fileName: string;
        await this.page.route(
            `/api/${version}/public/project/${uuid}/file/list`,
            async (route) => {
                if (onRoute) {
                    onRoute();
                }
                if (bodyType == 'default') {
                    const isAfterCompilation = getIsAfterCompilation
                        ? getIsAfterCompilation()
                        : undefined;
                    if (isAfterCompilation == undefined) {
                        fileName = 'example.txt';
                    } else if (!isAfterCompilation) {
                        fileName = 'first.txt';
                    } else {
                        fileName = 'second.txt';
                    }
                }
                await route.fulfill({
                    status: status,
                    contentType: contentType,
                    body: JSON.stringify(
                        this.getProjectBodyForFileList(bodyType, fileName)
                    ),
                });
            }
        );
    }

    //вспомогательная функция для save program
    private getProjectBodyForSaveProgram(
        typeBody: BodyTypeForSaveProgramRequest
    ) {
        if (typeBody == 'default') {
            return {
                projectId: uuid,
                userId: defaultUserId,
                title: 'Default Project',
                lastModified: new Date().toISOString(),
                program: {
                    segments: [],
                    parameters: {
                        roundStrategy: 'noRound',
                    },
                },
            };
        } else if (typeBody == 'empty') {
            return {};
        }
    }

    async setupSaveProgramRequest(
        status: number = 200,
        bodyType: BodyTypeForSaveProgramRequest = 'empty',
        onRoute?: (route: Route) => void
    ) {
        await this.page.route(
            `/api/${version}/public/project/${uuid}/program`,
            async (route) => {
                if (onRoute) {
                    onRoute(route);
                }
                await route.fulfill({
                    status: status,
                    contentType: contentType,
                    body: JSON.stringify(
                        this.getProjectBodyForSaveProgram(bodyType)
                    ),
                });
            }
        );
    }

    async setupGetTitleRequest(onRoute?: () => void) {
        await this.page.route(
            `/api/${version}/public/project/${uuid}/title*`,
            async (route) => {
                if (onRoute) {
                    onRoute();
                }
                await route.fulfill({
                    status: 200,
                    contentType: contentType,
                    body: JSON.stringify({
                        isOk: true,
                    }),
                });
            }
        );
    }

    async setupGetAllProjectsRequest() {
        await this.page.route(
            `/api/${version}/public/project/all`,
            async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: contentType,
                    body: JSON.stringify({
                        projects: [
                            {
                                projectId: uuid,
                                userId: defaultUserId,
                                title: 'Тестовый проект',
                                lastModified: '2024-03-20T12:00:00',
                            },
                        ],
                    }),
                });
            }
        );
    }

    // вспомогательная функция для Compile
    private getProjectBodyForCompile(
        typeBody: BodyTypeForCompileRequest,
        errors?: CompileErrorResult[],
        statements?: Statement[],
        text?: string
    ) {
        if (typeBody == 'errorBody') {
            return {
                errors: errors,
            };
        } else if (typeBody == 'empty') {
            return {};
        } else if (typeBody == 'computationalTypeBody') {
            return {
                segments: [
                    {
                        id: 0,
                        type: 'computational',
                        statements: statements,
                    },
                ],
            };
        } else if (typeBody == 'mdTypeBody') {
            return {
                segments: [
                    {
                        id: 1,
                        type: 'md',
                        statements: null,
                        text: text,
                    },
                ],
            };
        }
    }

    // перехватываем запрос на компиляцию
    async setupCompilationRequest(
        status: number = 200,
        bodyType: BodyTypeForCompileRequest,
        errors?: CompileErrorResult[],
        statements?: Statement[],
        text?: string
    ) {
        await this.page.route(
            `/api/${version}/public/compile`,
            async (route) => {
                await route.fulfill({
                    status: status,
                    contentType: contentType,
                    body: JSON.stringify(
                        this.getProjectBodyForCompile(
                            bodyType,
                            errors,
                            statements,
                            text
                        )
                    ),
                });
            }
        );
    }

    async setupProject() {
        await this.page.route(
            `/api/${version}/public/project/*`,
            async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: contentType,
                    body: JSON.stringify({
                        projectId: uuid,
                        userId: defaultUserId,
                        title: 'Default Project',
                        lastModified: new Date().toISOString(),
                        program: {
                            segments: [],
                            parameters: {
                                roundStrategy: 'noRound',
                            },
                        },
                    }),
                });
            }
        );
    }

    // Блокируем все запросы по умолчанию
    async setupApi(onRoute?: () => void) {
        await this.page.route('/api/*', async (route) => {
            if (onRoute) {
                onRoute();
            }
            await route.abort();
        });
    }

    async setupUploadFileRequest(status: number = 200) {
        await this.page.route(
            `/api/${version}/public/project/${uuid}/file/upload?name=test.csv`,
            async (route) => {
                await route.fulfill({
                    status: status,
                });
            }
        );
    }
}
