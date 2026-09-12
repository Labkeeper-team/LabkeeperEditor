import {
    CompileErrorResultList,
    CompileSuccessResult,
    Program,
    Project,
    ProjectType,
    UserInfo,
} from '../../model/domain.ts';
import { withSegmentIds } from '../../viewModel/utils/segmentId.ts';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { URLS } from '../../constants.ts';
import {
    AgentHistoryResponse,
    CodeValidationResponse,
    CompilationResponse,
    HunkListResponse,
    ListFilesResponse,
    ListProjectsResponse,
    RequestResult,
    RichProject,
    Rpi,
    UploadFileResponse,
    CompileSuccessPdfResponse,
    PdfPosition,
    ProgramDocumentPosition,
    BillingPurchaseResponse,
    BillingPurchasesListResponse,
    BillingPricingResponse,
} from '../../model/rpi';
import * as Sentry from '@sentry/react';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { logBreadcrumb } from '../../viewModel/utils/logBreadcrumb.ts';

function withIds(program: Program): Program {
    return withSegmentIds(program);
}

export class WebRpi implements Rpi {
    constructor(private observerService: ObserverService) {}

    private reportUnexpectedRpiStatus(
        method: keyof Rpi,
        expectedCodes: readonly number[],
        result: { code: number; body: unknown }
    ): void {
        if (expectedCodes.includes(result.code)) {
            return;
        }
        this.observerService.onEvent(Events.EVENT_RPI_UNKNOWN);
        Sentry.captureException(
            new Error(`Unexpected RPI status ${result.code} from ${method}`),
            {
                fingerprint: [
                    'rpi-unexpected-status',
                    String(method),
                    String(result.code),
                ],
                tags: {
                    'rpi.method': String(method),
                    'rpi.status': String(result.code),
                },
                extra: {
                    method,
                    code: result.code,
                    expectedCodes: [...expectedCodes],
                    body: result.body,
                },
            }
        );
    }

    private async requestWrapper<T extends object>(
        method: keyof Rpi,
        expectedCodes: readonly number[],
        request: () => Promise<AxiosResponse>
    ): Promise<RequestResult<T>> {
        logBreadcrumb('rpi', `start ${String(method)}`, { method });
        let result: RequestResult<T>;
        let hasHttpStatus = true;
        try {
            const response = await request();
            result = {
                code: response.status,
                body: response.data,
                isOk: response.status < 300,
                isUnauth: false,
                isForbidden: false,
            };
        } catch (error: unknown) {
            const axiosError = error as AxiosError;
            const status = axiosError?.response?.status;
            hasHttpStatus = status != null;
            result = {
                code: status || 500,
                body: axiosError?.response?.data as T,
                isOk: false,
                isUnauth: status === 401,
                isForbidden: status === 403,
            };
        }
        const expected = hasHttpStatus && expectedCodes.includes(result.code);
        logBreadcrumb(
            'rpi',
            hasHttpStatus
                ? `${String(method)} ${result.code}`
                : `${String(method)} network-error`,
            {
                method,
                code: result.code,
                isOk: result.isOk,
                isUnauth: result.isUnauth,
                isForbidden: result.isForbidden,
                hasHttpStatus,
                expected,
            },
            hasHttpStatus && expected ? 'info' : 'warning'
        );
        if (hasHttpStatus) {
            this.reportUnexpectedRpiStatus(method, expectedCodes, result);
        }
        return result;
    }

    setProjectTypeRequest(
        projectId: string,
        type: ProjectType
    ): Promise<RequestResult> {
        return this.requestWrapper(
            'setProjectTypeRequest',
            [200, 401],
            async () =>
                axios.post(
                    `${URLS.setType.replace('{id}', projectId)}?type=${type}`
                )
        );
    }
    pdfCompilationRequest(
        program: Program
    ): Promise<RequestResult<CompilationResponse>> {
        return this.requestWrapper(
            'pdfCompilationRequest',
            [200, 203, 401, 403, 402, 423, 425],
            async () => axios.post(URLS.compilePdf, withIds(program))
        );
    }
    async compilationRequest(
        program: Program
    ): Promise<RequestResult<CompileSuccessResult | CompileErrorResultList>> {
        return this.requestWrapper(
            'compilationRequest',
            [200, 203, 401, 403, 402, 425],
            async () => axios.post(URLS.compile, withIds(program))
        );
    }

    async contactFormRequest(
        subject: string,
        body: string
    ): Promise<RequestResult> {
        return this.requestWrapper('contactFormRequest', [200, 401], async () =>
            axios.post(URLS.Contact, null, {
                params: {
                    subject: subject,
                    body: body,
                },
            })
        );
    }

    async compileProjectRequest(
        projectId: string
    ): Promise<RequestResult<CompilationResponse>> {
        return this.requestWrapper(
            'compileProjectRequest',
            [200, 203, 401, 403, 402, 425],
            async () =>
                axios.post(URLS.compileProject.replace('{id}', projectId))
        );
    }

    async compileProjectPdfRequest(
        projectId: string
    ): Promise<RequestResult<CompileSuccessPdfResponse>> {
        return this.requestWrapper(
            'compileProjectPdfRequest',
            [200, 203, 401, 403, 402, 423, 425],
            async () =>
                axios.post(URLS.compileProjectPdf.replace('{id}', projectId))
        );
    }

    async navigationDocToPdfRequest(
        projectId: string,
        position: ProgramDocumentPosition
    ): Promise<RequestResult<PdfPosition>> {
        return this.requestWrapper(
            'navigationDocToPdfRequest',
            [200, 401, 423],
            async () =>
                axios.post(
                    URLS.navigationDocToPdf.replace('{id}', projectId),
                    position
                )
        );
    }

    async navigationPdfToDocRequest(
        projectId: string,
        position: PdfPosition
    ): Promise<RequestResult<ProgramDocumentPosition>> {
        return this.requestWrapper(
            'navigationPdfToDocRequest',
            [200, 401, 423],
            async () =>
                axios.post(
                    URLS.navigationPdfToDoc.replace('{id}', projectId),
                    position
                )
        );
    }

    async uploadFileRequest(
        formData: FormData,
        projectId: string,
        name: string
    ): Promise<RequestResult<UploadFileResponse>> {
        const uploadName =
            name.includes('/') && !name.startsWith('/') ? `/${name}` : name;
        return this.requestWrapper(
            'uploadFileRequest',
            [200, 400, 409, 413, 401, 403],
            async () =>
                axios.put(
                    `${URLS.uploadFile.replace('{id}', projectId)}`,
                    formData,
                    {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            Accept: '*/*',
                        },
                        params: {
                            name: uploadName,
                        },
                    }
                )
        );
    }

    async deleteFileRequest(
        name: string,
        projectId: string
    ): Promise<RequestResult> {
        return this.requestWrapper(
            'deleteFileRequest',
            [200, 401, 404],
            async () =>
                axios.delete(
                    `${URLS.deleteFile.replace('{id}', projectId)}?name=${name}`
                )
        );
    }

    async listFilesRequest(
        projectId: string
    ): Promise<RequestResult<ListFilesResponse>> {
        return this.requestWrapper(
            'listFilesRequest',
            [200, 401, 403],
            async () =>
                axios.get(`${URLS.filesGetList.replace('{id}', projectId)}`)
        );
    }

    async setTitleRequest(
        projectId: string,
        title: string
    ): Promise<RequestResult> {
        return this.requestWrapper('setTitleRequest', [200, 401], async () =>
            axios.post(
                `${URLS.setTitle.replace('{id}', projectId)}?name=${title}`
            )
        );
    }

    async getDefaultProjectRequest(
        lang: string,
        program: Program,
        projectType: ProjectType
    ): Promise<RequestResult<RichProject>> {
        return this.requestWrapper(
            'getDefaultProjectRequest',
            [200, 401],
            async () =>
                axios.post(
                    `${URLS.getDefaultProject}?type=${projectType}`,
                    withIds(program),
                    {
                        headers: {
                            'Accept-Language': lang || 'en',
                        },
                    }
                )
        );
    }

    async getProjectRequest(
        projectId: string
    ): Promise<RequestResult<RichProject>> {
        return this.requestWrapper(
            'getProjectRequest',
            [200, 401, 403, 404],
            async () => axios.get(URLS.getProject.replace('{id}', projectId))
        );
    }

    async renameFileRequest(
        oldName: string,
        newName: string,
        projectId: string
    ): Promise<RequestResult> {
        return this.requestWrapper(
            'renameFileRequest',
            [200, 400, 401, 417],
            async () =>
                axios.post(
                    `${URLS.renameFile.replace('{id}', projectId)}?old=${oldName}&new=${newName}`
                )
        );
    }

    async renameFolderRequest(
        oldPath: string,
        newPath: string,
        projectId: string
    ): Promise<RequestResult> {
        const oldParam = oldPath.startsWith('/') ? oldPath : `/${oldPath}`;
        const newParam = newPath.startsWith('/') ? newPath : `/${newPath}`;
        return this.requestWrapper(
            'renameFolderRequest',
            [200, 400, 401],
            async () =>
                axios.post(
                    `${URLS.renameFolder.replace('{id}', projectId)}?old=${encodeURIComponent(oldParam)}&new=${encodeURIComponent(newParam)}`
                )
        );
    }

    async deleteFolderRequest(
        folderPath: string,
        projectId: string
    ): Promise<RequestResult> {
        const pathParam = folderPath.startsWith('/')
            ? folderPath
            : `/${folderPath}`;
        return this.requestWrapper(
            'deleteFolderRequest',
            [200, 401],
            async () =>
                axios.delete(
                    `${URLS.deleteFolder.replace('{id}', projectId)}?path=${encodeURIComponent(pathParam)}`
                )
        );
    }

    async getAllProjectsRequest(): Promise<
        RequestResult<ListProjectsResponse>
    > {
        return this.requestWrapper(
            'getAllProjectsRequest',
            [200, 401],
            async () => axios.get(URLS.getAllProjects)
        );
    }

    async createProjectRequest(
        projectName: string,
        program: Program,
        projectType: ProjectType
    ): Promise<RequestResult<Project>> {
        return this.requestWrapper(
            'createProjectRequest',
            [200, 401, 417],
            async () =>
                axios.put(
                    `${URLS.createProject}?name=${projectName}&type=${projectType}`,
                    withIds(program)
                )
        );
    }

    async cloneProjectRequest(
        projectId: string
    ): Promise<RequestResult<Project>> {
        return this.requestWrapper(
            'cloneProjectRequest',
            [200, 401, 417],
            async () =>
                axios.post(`${URLS.cloneProject.replace('{id}', projectId)}`)
        );
    }

    async deleteProjectRequest(projectId: string): Promise<RequestResult> {
        return this.requestWrapper(
            'deleteProjectRequest',
            [200, 401],
            async () =>
                axios.delete(URLS.deleteProject.replace('{id}', projectId))
        );
    }

    async saveProgramRequest(
        projectId: string,
        program: Program
    ): Promise<RequestResult> {
        return this.requestWrapper('saveProgramRequest', [200, 401], async () =>
            axios.post(
                URLS.setProgram.replace('{id}', projectId),
                withIds(program)
            )
        );
    }

    async setProjectVisibilityRequest(
        projectId: string,
        visibility: boolean
    ): Promise<RequestResult> {
        return this.requestWrapper(
            'setProjectVisibilityRequest',
            [200, 401],
            async () =>
                axios.post(
                    `${URLS.setVisibility.replace('{id}', projectId)}?public=${visibility}`
                )
        );
    }

    async sendEmailWithCodeRequest(
        email: string,
        registration: boolean,
        lang: string,
        captcha: string
    ): Promise<RequestResult> {
        return this.requestWrapper(
            'sendEmailWithCodeRequest',
            [200, 400, 404, 409],
            () =>
                axios.post(URLS.Email, null, {
                    params: { email, registration, captcha },
                    headers: { 'Accept-Language': lang || 'en' },
                })
        );
    }

    async checkCodeRequest(
        email: string,
        code: string
    ): Promise<RequestResult<CodeValidationResponse>> {
        return this.requestWrapper('checkCodeRequest', [200, 400], () =>
            axios.post<CodeValidationResponse>(URLS.Code, null, {
                params: { email, code },
            })
        );
    }

    async setPasswordRequest(
        email: string,
        code: string,
        password: string,
        registration: boolean
    ): Promise<RequestResult> {
        return this.requestWrapper(
            'setPasswordRequest',
            [200, 400, 404, 409],
            () =>
                axios.post(URLS.Password, null, {
                    params: { email, code, password, registration },
                })
        );
    }

    async getUserInfoRequest(): Promise<RequestResult<UserInfo>> {
        return this.requestWrapper('getUserInfoRequest', [200], () =>
            axios.get(URLS.UserInfo)
        );
    }

    async acceptPrivacyPolicyRequest(): Promise<RequestResult> {
        return this.requestWrapper(
            'acceptPrivacyPolicyRequest',
            [200, 401],
            () => axios.post(URLS.PrivacyPolicyAcceptance)
        );
    }

    async acceptCrossBorderConsentRequest(): Promise<RequestResult> {
        return this.requestWrapper(
            'acceptCrossBorderConsentRequest',
            [200, 401],
            () => axios.post(URLS.CrossBorderConsentAcceptance)
        );
    }

    async getBillingPricingRequest(): Promise<
        RequestResult<BillingPricingResponse>
    > {
        return this.requestWrapper('getBillingPricingRequest', [200], () =>
            axios.get(URLS.billingPricing)
        );
    }

    async createBillingPurchaseRequest(
        tokenPriceId: string
    ): Promise<RequestResult<BillingPurchaseResponse>> {
        return this.requestWrapper(
            'createBillingPurchaseRequest',
            [200, 401],
            () =>
                axios.post(URLS.billingPurchases, null, {
                    params: {
                        tokenPriceId,
                        integration: 'yookassa',
                    },
                })
        );
    }

    async listBillingPurchasesRequest(params?: {
        page?: number;
        size?: number;
        status?: BillingPurchaseResponse['status'];
    }): Promise<RequestResult<BillingPurchasesListResponse>> {
        return this.requestWrapper(
            'listBillingPurchasesRequest',
            [200, 401],
            () =>
                axios.get(URLS.billingPurchases, {
                    params: {
                        page: params?.page ?? 0,
                        size: params?.size ?? 1,
                        status: params?.status ?? 'pending',
                    },
                })
        );
    }

    async getS3FileRequest(path: string): Promise<RequestResult> {
        return this.requestWrapper('getS3FileRequest', [200], () =>
            axios.get(URLS.S3File + path)
        );
    }

    async formLoginRequest(
        userName: string,
        password: string,
        captcha: string
    ): Promise<RequestResult> {
        const params = new URLSearchParams();
        params.append('username', userName);
        params.append('password', password);
        params.append('captcha', captcha);
        return this.requestWrapper('formLoginRequest', [200, 401], () =>
            axios.post(URLS.FormLogin, params)
        );
    }

    async oauthCodeRequest(
        code: string,
        state: string
    ): Promise<RequestResult> {
        return this.requestWrapper('oauthCodeRequest', [200, 400, 401], () =>
            axios.get(URLS.OauthCode + '/provider', {
                params: {
                    code: code,
                    state: state,
                },
            })
        );
    }

    async logoutRequest(): Promise<RequestResult> {
        return this.requestWrapper('logoutRequest', [200, 401], () =>
            axios.post(URLS.Logout)
        );
    }

    async listHunksRequest(
        projectId: string
    ): Promise<RequestResult<HunkListResponse>> {
        return this.requestWrapper('listHunksRequest', [200, 401, 403], () =>
            axios.get(URLS.listHunks.replace('{id}', projectId))
        );
    }

    async deleteHunkRequest(
        projectId: string,
        hunkId: string,
        revert: boolean
    ): Promise<RequestResult> {
        return this.requestWrapper('deleteHunkRequest', [200, 401], () =>
            axios.delete(
                URLS.deleteHunk
                    .replace('{id}', projectId)
                    .replace('{hunkId}', hunkId),
                { params: { revert } }
            )
        );
    }

    async getAgentHistoryRequest(
        projectId: string
    ): Promise<RequestResult<AgentHistoryResponse>> {
        return this.requestWrapper('getAgentHistoryRequest', [200, 401], () =>
            axios.get(URLS.agentHistory.replace('{id}', projectId))
        );
    }

    async clearAgentHistoryRequest(projectId: string): Promise<RequestResult> {
        return this.requestWrapper('clearAgentHistoryRequest', [200, 401], () =>
            axios.delete(URLS.agentHistory.replace('{id}', projectId))
        );
    }
}
