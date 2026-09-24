import axios from 'axios';
import * as Sentry from '@sentry/react';
import { Program } from '../../../model/domain.ts';
import { RequestResult, Rpi } from '../../../model/rpi';
import { Events } from '../../../model/service/ObserverService.ts';
import { WebRpi } from '../../../web/server';
import {
    adoptAnalyticsSessionId,
    LABKEEPER_SESSION_HEADER,
} from '../../../web/session.ts';

const createRpi = () => {
    const observerService = {
        init: jest.fn(),
        onEvent: jest.fn(),
        setUserState: jest.fn(),
        onLogout: jest.fn(),
    };
    return { rpi: new WebRpi(observerService), observerService };
};

// адреса нужны всем методам: без адреса .replace бросает TypeError, и опыт видит сетевую ошибку вместо ответа
jest.mock('../../../constants.ts', () => ({
    URLS: {
        compile: '/api/v4/public/compile',
        compilePdf: '/api/v4/public/compile/pdf',
        compileProject: '/api/v4/public/project/{id}/compile',
        compileProjectPdf: '/api/v4/public/project/{id}/compile/pdf',
        navigationDocToPdf: '/api/v4/public/project/{id}/navigation/pdf',
        navigationPdfToDoc: '/api/v4/public/project/{id}/navigation/doc',
        getAllProjects: '/api/v4/public/project/all',
        getDefaultProject: '/api/v4/public/project/default',
        createProject: '/api/v4/public/project/create',
        cloneProject: '/api/v4/public/project/{id}/clone',
        deleteProject: '/api/v4/public/project/{id}/delete',
        getProject: '/api/v4/public/project/{id}/get',
        setProgram: '/api/v4/public/project/{id}/program',
        setTitle: '/api/v4/public/project/{id}/title',
        setVisibility: '/api/v4/public/project/{id}/visibility',
        setType: '/api/v4/public/project/{id}/type',
        listHunks: '/api/v4/public/project/{id}/hunk',
        deleteHunk: '/api/v4/public/project/{id}/hunk/{hunkId}',
        agentHistory: '/api/v4/public/project/{id}/history',
        filesGetList: '/api/v4/public/project/{id}/file/list',
        uploadFile: '/api/v4/public/project/{id}/file/upload',
        renameFile: '/api/v2/public/project/{id}/file/rename',
        deleteFile: '/api/v4/public/project/{id}/file/delete',
        renameFolder: '/api/v4/public/project/{id}/file/folder/rename',
        deleteFolder: '/api/v4/public/project/{id}/file/folder/delete',
        UserInfo: '/api/v4/public/user-info',
        PrivacyPolicyAcceptance: '/api/v4/public/privacy-policy/accept',
        CrossBorderDataTransferPolicyAcceptance:
            '/api/v4/public/cross-border-data-transfer-policy/accept',
        S3File: 'https://files.labkeeper.io/',
        Email: '/api/v4/public/email',
        Code: '/api/v4/public/code',
        Password: '/api/v4/public/password',
        Contact: '/api/v4/public/contact',
        billingPricing: '/api/v4/public/billing/pricing',
        billingPurchases: '/api/v4/public/billing/purchases',
        FormLogin: '/api/v4/sec/formlogin',
        OauthCode: '/api/v4/sec/login/oauth2/code',
        Logout: '/api/v4/sec/logout',
    },
}));

jest.mock('@sentry/react', () => ({
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
}));

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        put: jest.fn(),
        interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
        },
    },
}));

// перехватчик регистрируется один раз при импорте модуля, а beforeEach чистит mock.calls
const attachSessionHeader = (axios.interceptors.request.use as jest.Mock).mock
    .calls[0][0] as (config: { headers: Record<string, string> }) => {
    headers: Record<string, string>;
};

const PROJECT_ID = 'project-id';
const program: Program = {
    segments: [],
    parameters: { roundStrategy: 'noRound' },
};

type RpiCase = {
    method: keyof Rpi;
    source: string;
    // метод работает с проектом, и его id должен дойти до события
    scoped: boolean;
    // 423 в списке ожидаемых кодов метода
    expects423: boolean;
    call: (rpi: WebRpi) => Promise<RequestResult<object>>;
};

// все методы Rpi: забытый projectId или источник в одном из них иначе проходит молча
const RPI_CASES: RpiCase[] = [
    {
        method: 'setProjectTypeRequest',
        source: 'project',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.setProjectTypeRequest(PROJECT_ID, 'latex'),
    },
    {
        method: 'pdfCompilationRequest',
        source: 'compile',
        scoped: false,
        expects423: true,
        call: (rpi) => rpi.pdfCompilationRequest(program),
    },
    {
        method: 'compilationRequest',
        source: 'compile',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.compilationRequest(program),
    },
    {
        method: 'contactFormRequest',
        source: 'contact',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.contactFormRequest('subject', 'body'),
    },
    {
        method: 'compileProjectRequest',
        source: 'compile',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.compileProjectRequest(PROJECT_ID),
    },
    {
        method: 'compileProjectPdfRequest',
        source: 'compile',
        scoped: true,
        expects423: true,
        call: (rpi) => rpi.compileProjectPdfRequest(PROJECT_ID),
    },
    {
        method: 'navigationDocToPdfRequest',
        source: 'synctex',
        scoped: true,
        expects423: true,
        call: (rpi) =>
            rpi.navigationDocToPdfRequest(PROJECT_ID, {
                segmentId: 1,
                line: 1,
            }),
    },
    {
        method: 'navigationPdfToDocRequest',
        source: 'synctex',
        scoped: true,
        expects423: true,
        call: (rpi) =>
            rpi.navigationPdfToDocRequest(PROJECT_ID, {
                page: 1,
                x: 1,
                y: 1,
            }),
    },
    {
        method: 'uploadFileRequest',
        source: 'file',
        scoped: true,
        expects423: true,
        call: (rpi) =>
            rpi.uploadFileRequest(new FormData(), PROJECT_ID, 'main.tex'),
    },
    {
        method: 'deleteFileRequest',
        source: 'file',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.deleteFileRequest('main.tex', PROJECT_ID),
    },
    {
        method: 'listFilesRequest',
        source: 'file',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.listFilesRequest(PROJECT_ID),
    },
    {
        method: 'setTitleRequest',
        source: 'project',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.setTitleRequest(PROJECT_ID, 'title'),
    },
    {
        method: 'getDefaultProjectRequest',
        source: 'project',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.getDefaultProjectRequest('en', program, 'latex'),
    },
    {
        method: 'getProjectRequest',
        source: 'project',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.getProjectRequest(PROJECT_ID),
    },
    {
        method: 'renameFileRequest',
        source: 'file',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.renameFileRequest('a.tex', 'b.tex', PROJECT_ID),
    },
    {
        method: 'renameFolderRequest',
        source: 'file',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.renameFolderRequest('a', 'b', PROJECT_ID),
    },
    {
        method: 'deleteFolderRequest',
        source: 'file',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.deleteFolderRequest('a', PROJECT_ID),
    },
    {
        method: 'getAllProjectsRequest',
        source: 'project',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.getAllProjectsRequest(),
    },
    {
        method: 'createProjectRequest',
        source: 'project',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.createProjectRequest('name', program, 'latex'),
    },
    {
        method: 'cloneProjectRequest',
        source: 'project',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.cloneProjectRequest(PROJECT_ID),
    },
    {
        method: 'deleteProjectRequest',
        source: 'project',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.deleteProjectRequest(PROJECT_ID),
    },
    {
        method: 'saveProgramRequest',
        source: 'program',
        scoped: true,
        expects423: true,
        call: (rpi) => rpi.saveProgramRequest(PROJECT_ID, program),
    },
    {
        method: 'setProjectVisibilityRequest',
        source: 'project',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.setProjectVisibilityRequest(PROJECT_ID, true),
    },
    {
        method: 'sendEmailWithCodeRequest',
        source: 'auth',
        scoped: false,
        expects423: false,
        call: (rpi) =>
            rpi.sendEmailWithCodeRequest('a@b.c', true, 'en', 'captcha'),
    },
    {
        method: 'checkCodeRequest',
        source: 'auth',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.checkCodeRequest('a@b.c', '1234'),
    },
    {
        method: 'setPasswordRequest',
        source: 'auth',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.setPasswordRequest('a@b.c', '1234', 'pass', true),
    },
    {
        method: 'getUserInfoRequest',
        source: 'user',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.getUserInfoRequest(),
    },
    {
        method: 'acceptPrivacyPolicyRequest',
        source: 'user',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.acceptPrivacyPolicyRequest(),
    },
    {
        method: 'acceptCrossBorderDataTransferPolicyRequest',
        source: 'user',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.acceptCrossBorderDataTransferPolicyRequest(),
    },
    {
        method: 'getBillingPricingRequest',
        source: 'billing',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.getBillingPricingRequest(),
    },
    {
        method: 'createBillingPurchaseRequest',
        source: 'billing',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.createBillingPurchaseRequest('price-1'),
    },
    {
        method: 'listBillingPurchasesRequest',
        source: 'billing',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.listBillingPurchasesRequest(),
    },
    {
        method: 'getS3FileRequest',
        source: 'file',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.getS3FileRequest('image.png'),
    },
    {
        method: 'formLoginRequest',
        source: 'auth',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.formLoginRequest('user', 'pass', 'captcha'),
    },
    {
        method: 'oauthCodeRequest',
        source: 'auth',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.oauthCodeRequest('code', 'state'),
    },
    {
        method: 'logoutRequest',
        source: 'auth',
        scoped: false,
        expects423: false,
        call: (rpi) => rpi.logoutRequest(),
    },
    {
        method: 'listHunksRequest',
        source: 'hunk',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.listHunksRequest(PROJECT_ID),
    },
    {
        method: 'deleteHunkRequest',
        source: 'hunk',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.deleteHunkRequest(PROJECT_ID, 'hunk-1', true),
    },
    {
        method: 'getAgentHistoryRequest',
        source: 'agent_history',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.getAgentHistoryRequest(PROJECT_ID),
    },
    {
        method: 'clearAgentHistoryRequest',
        source: 'agent_history',
        scoped: true,
        expects423: false,
        call: (rpi) => rpi.clearAgentHistoryRequest(PROJECT_ID),
    },
];

const HTTP_METHODS = ['post', 'get', 'delete', 'put'] as const;

// сервер отвечает этим кодом на любой запрос; axios отклоняет всё, что не 2xx
const respondWith = (status: number) => {
    HTTP_METHODS.forEach((name) => {
        const mock = axios[name] as jest.Mock;
        if (status < 300) {
            mock.mockResolvedValue({ status, data: {} });
        } else {
            mock.mockRejectedValue({ response: { status, data: {} } });
        }
    });
};

const lockedEvents = (onEvent: jest.Mock) =>
    onEvent.mock.calls.filter(
        ([event]) => event === Events.EVENT_PROJECT_LOCKED
    );

describe('WebRpi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renameFileRequest passes old and new file names as-is', async () => {
        const postMock = axios.post as jest.Mock;
        postMock.mockResolvedValue({
            status: 200,
            data: {},
        });
        const { rpi } = createRpi();

        await rpi.renameFileRequest(
            'note.txt',
            'folder name/<>?.txt',
            'project-id'
        );

        expect(postMock).toHaveBeenCalledWith(
            expect.stringContaining('old=note.txt&new=folder name/<>?.txt')
        );
    });

    test('getBillingPricingRequest loads billing pricing', async () => {
        const getMock = axios.get as jest.Mock;
        const pricing = {
            servicePrices: {
                latexCompilationTokenCostPerSecond: 0,
                markdownCompilationTokenCostPerSecond: 0,
                gptTextPromptTokenCost: 1,
            },
            tokenPrices: [{ tokensToPurchase: 1, costRubles: 1 }],
            userRegularRefill: {
                refillTokensAmount: 1000,
                refillPeriodSeconds: 86400,
            },
            newUserInitialTokensCount: 1000,
        };
        getMock.mockResolvedValue({
            status: 200,
            data: pricing,
        });
        const { rpi, observerService } = createRpi();

        const result = await rpi.getBillingPricingRequest();

        expect(getMock).toHaveBeenCalledWith('/api/v4/public/billing/pricing');
        expect(result.body).toEqual(pricing);
        expect(result.isOk).toBe(true);
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(observerService.onEvent).not.toHaveBeenCalled();
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'start getBillingPricingRequest',
            })
        );
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'getBillingPricingRequest 200',
                level: 'info',
            })
        );
    });

    test('does not report an expected error status to Sentry or Metrika', async () => {
        const getMock = axios.get as jest.Mock;
        getMock.mockRejectedValue({
            response: { status: 401, data: {} },
        });
        const { rpi, observerService } = createRpi();

        const result = await rpi.getAgentHistoryRequest('project-id');

        expect(result.code).toBe(401);
        expect(result.isUnauth).toBe(true);
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(observerService.onEvent).not.toHaveBeenCalled();
    });

    test('reports an unexpected status to Sentry and Metrika and still returns the result', async () => {
        const getMock = axios.get as jest.Mock;
        getMock.mockRejectedValue({
            response: { status: 500, data: { message: 'boom' } },
        });
        const { rpi, observerService } = createRpi();

        const result = await rpi.getBillingPricingRequest();

        expect(result.code).toBe(500);
        expect(result.isOk).toBe(false);
        expect(result.body).toEqual({ message: 'boom' });
        expect(observerService.onEvent).toHaveBeenCalledWith(
            Events.EVENT_RPI_UNKNOWN,
            expect.objectContaining({
                source: 'rpi',
                operation: 'getBillingPricingRequest',
            })
        );
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'getBillingPricingRequest 500',
                level: 'warning',
            })
        );
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        const [error, context] = (Sentry.captureException as jest.Mock).mock
            .calls[0];
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(
            'Unexpected RPI status 500 from getBillingPricingRequest'
        );
        expect(context.tags['rpi.method']).toBe('getBillingPricingRequest');
        expect(context.tags['rpi.status']).toBe('500');
        expect(context.extra.expectedCodes).toEqual([200]);
        expect(context.fingerprint).toEqual([
            'rpi-unexpected-status',
            'getBillingPricingRequest',
            '500',
        ]);
    });

    test('reports an unexpected success-path status to Sentry and Metrika', async () => {
        const getMock = axios.get as jest.Mock;
        getMock.mockResolvedValue({
            status: 201,
            data: {},
        });
        const { rpi, observerService } = createRpi();

        const result = await rpi.getBillingPricingRequest();

        expect(result.code).toBe(201);
        expect(result.isOk).toBe(true);
        expect(observerService.onEvent).toHaveBeenCalledWith(
            Events.EVENT_RPI_UNKNOWN,
            expect.objectContaining({
                source: 'rpi',
                operation: 'getBillingPricingRequest',
            })
        );
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'getBillingPricingRequest 201',
                level: 'warning',
            })
        );
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        expect(
            (Sentry.captureException as jest.Mock).mock.calls[0][0].message
        ).toBe('Unexpected RPI status 201 from getBillingPricingRequest');
    });

    test('does not report a network error without an HTTP status to Sentry or Metrika', async () => {
        const getMock = axios.get as jest.Mock;
        getMock.mockRejectedValue(new Error('Network Error'));
        const { rpi, observerService } = createRpi();

        const result = await rpi.getBillingPricingRequest();

        expect(result.code).toBe(500);
        expect(result.isOk).toBe(false);
        expect(Sentry.captureException).not.toHaveBeenCalled();
        expect(observerService.onEvent).not.toHaveBeenCalled();
        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                category: 'rpi',
                message: 'getBillingPricingRequest network-error',
                level: 'warning',
            })
        );
    });

    test('getAgentHistoryRequest asks the history of the given project', async () => {
        const getMock = axios.get as jest.Mock;
        const history = [
            {
                id: 1,
                request: 'сделай таблицу',
                response: 'готово',
                createdAt: '2026-09-08T10:00:00Z',
            },
        ];
        getMock.mockResolvedValue({ status: 200, data: { history } });
        const { rpi } = createRpi();

        const result = await rpi.getAgentHistoryRequest('project-id');

        expect(getMock).toHaveBeenCalledWith(
            '/api/v4/public/project/project-id/history'
        );
        expect(result.body.history).toEqual(history);
        expect(result.isOk).toBe(true);
    });

    test('clearAgentHistoryRequest deletes the history of the given project', async () => {
        const deleteMock = axios.delete as jest.Mock;
        deleteMock.mockResolvedValue({ status: 200, data: {} });
        const { rpi } = createRpi();

        const result = await rpi.clearAgentHistoryRequest('project-id');

        expect(deleteMock).toHaveBeenCalledWith(
            '/api/v4/public/project/project-id/history'
        );
        expect(result.isOk).toBe(true);
    });

    test('the case table covers every Rpi method', () => {
        const methods = Object.getOwnPropertyNames(WebRpi.prototype).filter(
            (name) => name !== 'constructor' && name.endsWith('Request')
        );

        expect(RPI_CASES.map((c) => c.method).sort()).toEqual(methods.sort());
    });

    test.each(RPI_CASES)(
        '423 from $method sends one locked event with its source and project',
        async ({ method, source, scoped, expects423, call }) => {
            respondWith(423);
            const { rpi, observerService } = createRpi();

            const result = await call(rpi);

            // код дошёл из ответа: значит, запрос ушёл в axios, а не упал раньше
            expect(result.code).toBe(423);
            expect(lockedEvents(observerService.onEvent)).toEqual([
                [
                    Events.EVENT_PROJECT_LOCKED,
                    {
                        source,
                        operation: method,
                        expected: expects423,
                        ...(scoped ? { project_id: PROJECT_ID } : {}),
                    },
                ],
            ]);
        }
    );

    test.each(RPI_CASES.filter((c) => c.expects423))(
        'an expected 423 from $method does not go to Sentry',
        async ({ call }) => {
            respondWith(423);
            const { rpi, observerService } = createRpi();

            await call(rpi);

            expect(Sentry.captureException).not.toHaveBeenCalled();
            expect(observerService.onEvent).not.toHaveBeenCalledWith(
                Events.EVENT_RPI_UNKNOWN,
                expect.anything()
            );
        }
    );

    test('an unexpected 423 sends the locked event and is still reported as unknown', async () => {
        respondWith(423);
        const { rpi, observerService } = createRpi();

        await rpi.deleteProjectRequest(PROJECT_ID);

        expect(observerService.onEvent).toHaveBeenCalledWith(
            Events.EVENT_PROJECT_LOCKED,
            expect.objectContaining({
                operation: 'deleteProjectRequest',
                expected: false,
            })
        );
        expect(observerService.onEvent).toHaveBeenCalledWith(
            Events.EVENT_RPI_UNKNOWN,
            expect.objectContaining({ operation: 'deleteProjectRequest' })
        );
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        expect(
            (Sentry.captureException as jest.Mock).mock.calls[0][0].message
        ).toBe('Unexpected RPI status 423 from deleteProjectRequest');
    });

    test.each([200, 401, 403, 409, 422, 424, 425, 500])(
        'status %s does not send the locked event',
        async (status) => {
            respondWith(status);
            const { rpi, observerService } = createRpi();

            const save = await rpi.saveProgramRequest(PROJECT_ID, program);
            const compile = await rpi.compileProjectPdfRequest(PROJECT_ID);

            expect(save.code).toBe(status);
            expect(compile.code).toBe(status);
            expect(lockedEvents(observerService.onEvent)).toEqual([]);
        }
    );

    test('a network error without an HTTP status does not send the locked event', async () => {
        HTTP_METHODS.forEach((name) =>
            (axios[name] as jest.Mock).mockRejectedValue(
                new Error('Network Error')
            )
        );
        const { rpi, observerService } = createRpi();

        await rpi.saveProgramRequest(PROJECT_ID, program);

        expect(lockedEvents(observerService.onEvent)).toEqual([]);
    });

    // последним в файле: sessionId лежит в модульной переменной и живёт до конца прогона
    test('session header appears only after the session id is known', () => {
        expect(
            attachSessionHeader({ headers: {} }).headers[
                LABKEEPER_SESSION_HEADER
            ]
        ).toBeUndefined();

        adoptAnalyticsSessionId('s-1');

        expect(
            attachSessionHeader({ headers: {} }).headers[
                LABKEEPER_SESSION_HEADER
            ]
        ).toBe('s-1');
    });
});
