import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    Program,
    Project,
    ProjectShort,
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

export interface ListFilesResponse {
    files: LabkeeperFile[];
}

export interface ListProjectsResponse {
    projects: ProjectShort[];
}

export interface CodeValidationResponse {
    valid: boolean;
}

export interface RichProject extends Project {
    lastProgramResult?: CompileSuccessResult;
}

export interface Rpi {
    compilationRequest(
        program: Program
    ): Promise<RequestResult<CompilationResponse>>;

    contactFormRequest(subject: string, body: string): Promise<RequestResult>;

    compileProjectRequest(
        projectId: string
    ): Promise<RequestResult<CompilationResponse>>;

    compileProjectPdfRequest(
        projectId: string
    ): Promise<RequestResult<PdfCompilationResponse>>;

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

    renameFileRequest(oldName: string, newName: string, projectId: string);

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
    } as unknown as Rpi;
};
