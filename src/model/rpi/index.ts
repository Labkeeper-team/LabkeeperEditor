import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    Program,
    Project,
    ProjectShort,
    ProjectType,
    UserInfo,
} from '../domain.ts';

export interface RequestResult<T = object> {
    body: T;
    code: number;
    isOk: boolean;
    isUnauth: boolean;
    isForbidden: boolean;
}

export type CompilationResponse = CompileSuccessResult | CompileErrorResultList;
export type PdfCompilationResponse =
    | CompileSuccessPdfResponse
    | CompileErrorResultList;

export interface UploadFileResponse {
    url: string;
}

export interface CompileSuccessPdfResponse {
    pdfUri: string;
}

export interface ProgramDocumentPosition {
    segmentId: number;
    line: number;
}

export interface PdfPosition {
    page: number;
    x: number;
    y: number;
}

export interface ListFilesResponse {
    files: LabkeeperFile[];
}

export interface ListProjectsResponse {
    projects: ProjectShort[];
    projectTagsByProject?: Record<string, Record<string, string>>;
}

export interface CodeValidationResponse {
    valid: boolean;
}

export interface ServicePrices {
    latexCompilationTokenCostPerSecond: number;
    markdownCompilationTokenCostPerSecond: number;
    gptTextPromptTokenCost: number;
    gptImagePromptTokenCost: number;
}

export interface TokenPrice {
    tokensToPurchase: number;
    costRubles: number;
}

export interface UserRegularRefill {
    refillTokensAmount: number;
    refillPeriodSeconds: number;
}

export interface BillingPricingResponse {
    servicePrices: ServicePrices;
    tokenPrices: TokenPrice[];
    userRegularRefill: UserRegularRefill;
    newUserInitialTokensCount: number;
}

export interface RichProject extends Project {
    lastProgramResult?: CompileSuccessResult;
    lastPdf?: string;
}

export interface Rpi {
    compilationRequest(
        program: Program
    ): Promise<RequestResult<CompilationResponse>>;

    pdfCompilationRequest(
        program: Program
    ): Promise<RequestResult<CompilationResponse>>;

    contactFormRequest(subject: string, body: string): Promise<RequestResult>;

    compileProjectRequest(
        projectId: string
    ): Promise<RequestResult<CompilationResponse>>;

    compileProjectPdfRequest(
        projectId: string
    ): Promise<RequestResult<PdfCompilationResponse>>;

    navigationDocToPdfRequest(
        projectId: string,
        position: ProgramDocumentPosition
    ): Promise<RequestResult<PdfPosition>>;

    navigationPdfToDocRequest(
        projectId: string,
        position: PdfPosition
    ): Promise<RequestResult<ProgramDocumentPosition>>;

    uploadFileRequest(
        formData: FormData,
        projectId: string,
        name: string
    ): Promise<RequestResult<UploadFileResponse>>;

    deleteFileRequest(name: string, projectId: string): Promise<RequestResult>;

    listFilesRequest(
        projectId: string
    ): Promise<RequestResult<ListFilesResponse>>;

    setTitleRequest(projectId: string, title: string): Promise<RequestResult>;

    getDefaultProjectRequest(
        lang: string,
        program: Program
    ): Promise<RequestResult<RichProject>>;

    getProjectRequest(projectId: string): Promise<RequestResult<RichProject>>;

    renameFileRequest(
        oldName: string,
        newName: string,
        projectId: string
    ): Promise<RequestResult>;

    renameFolderRequest(
        oldPath: string,
        newPath: string,
        projectId: string
    ): Promise<RequestResult>;

    deleteFolderRequest(
        folderPath: string,
        projectId: string
    ): Promise<RequestResult>;

    // TODO(folder API): moveFileRequest когда появится на сервере (вариант B для TODO 3):
    // moveFileRequest(oldPath: string, targetFolder: string, projectId: string): Promise<RequestResult>;

    getAllProjectsRequest(): Promise<RequestResult<ListProjectsResponse>>;

    createProjectRequest(
        projectName: string,
        program: Program
    ): Promise<RequestResult<Project>>;

    cloneProjectRequest(projectId: string): Promise<RequestResult<Project>>;

    deleteProjectRequest(projectId: string): Promise<RequestResult>;

    saveProgramRequest(
        projectId: string,
        program: Program
    ): Promise<RequestResult>;

    setProjectVisibilityRequest(
        projectId: string,
        visibility: boolean
    ): Promise<RequestResult>;

    setProjectTypeRequest(
        projectId: string,
        type: ProjectType
    ): Promise<RequestResult>;

    updateProjectTagsRequest(
        projectId: string,
        tags: Record<string, string>
    ): Promise<RequestResult>;

    sendEmailWithCodeRequest(
        email: string,
        registration: boolean,
        lang: string,
        captcha: string
    ): Promise<RequestResult>;

    checkCodeRequest(
        email: string,
        code: string
    ): Promise<RequestResult<CodeValidationResponse>>;

    setPasswordRequest(
        email: string,
        code: string,
        password: string,
        registration: boolean
    ): Promise<RequestResult>;

    getUserInfoRequest(): Promise<RequestResult<UserInfo>>;

    getS3FileRequest(path: string): Promise<RequestResult>;

    formLoginRequest(
        userName: string,
        password: string,
        captcha: string
    ): Promise<RequestResult>;

    oauthCodeRequest(code: string, state: string): Promise<RequestResult>;

    logoutRequest(): Promise<RequestResult>;

    promptProjectRequest(
        projectId: string,
        prompt: string
    ): Promise<RequestResult<Program>>;

    generateImageInProjectRequest(
        projectId: string,
        prompt: string
    ): Promise<RequestResult<Program>>;

    unauthorizedPromptProjectRequest(
        program: Program,
        prompt: string
    ): Promise<RequestResult<Program>>;

    getBillingPricingRequest(): Promise<RequestResult<BillingPricingResponse>>;
}

export const mockRpi = (): Rpi => {
    return {
        compilationRequest: () => {
            throw new Error('Not implemented');
        },
        compileProjectRequest: () => {
            throw new Error('Not implemented');
        },
        uploadFileRequest: () => {
            throw new Error('Not implemented');
        },
        deleteFileRequest: () => {
            throw new Error('Not implemented');
        },
        listFilesRequest: () => {
            throw new Error('Not implemented');
        },
        setTitleRequest: () => {
            throw new Error('Not implemented');
        },
        getDefaultProjectRequest: () => {
            throw new Error('Not implemented');
        },
        getProjectRequest: () => {
            throw new Error('Not implemented');
        },
        renameFileRequest: () => {
            throw new Error('Not implemented');
        },
        renameFolderRequest: () => {
            throw new Error('Not implemented');
        },
        deleteFolderRequest: () => {
            throw new Error('Not implemented');
        },
        getAllProjectsRequest: () => {
            throw new Error('Not implemented');
        },
        createProjectRequest: () => {
            throw new Error('Not implemented');
        },
        deleteProjectRequest: () => {
            throw new Error('Not implemented');
        },
        saveProgramRequest: () => {
            throw new Error('Not implemented');
        },
        setProjectVisibilityRequest: () => {
            throw new Error('Not implemented');
        },
        updateProjectTagsRequest: () => {
            throw new Error('Not implemented');
        },
        sendEmailWithCodeRequest: () => {
            throw new Error('Not implemented');
        },
        checkCodeRequest: () => {
            throw new Error('Not implemented');
        },
        setPasswordRequest: () => {
            throw new Error('Not implemented');
        },
        getUserInfoRequest: () => {
            throw new Error('Not implemented');
        },
        getBillingPricingRequest: () =>
            Promise.resolve({
                code: 200,
                body: {
                    servicePrices: {
                        latexCompilationTokenCostPerSecond: 0,
                        markdownCompilationTokenCostPerSecond: 0,
                        gptTextPromptTokenCost: 0,
                        gptImagePromptTokenCost: 0,
                    },
                    tokenPrices: [],
                    userRegularRefill: {
                        refillTokensAmount: 0,
                        refillPeriodSeconds: 0,
                    },
                    newUserInitialTokensCount: 0,
                },
                isOk: true,
                isUnauth: false,
                isForbidden: false,
            }),
    } as unknown as Rpi;
};
