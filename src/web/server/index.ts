import {
    CompileErrorResultList,
    CompileSuccessResult,
    Program,
    Project,
    ProjectType,
    Segment,
    UserInfo,
} from '../../model/domain.ts';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { URLS } from '../../constants.ts';
import {
    CodeValidationResponse,
    CompilationResponse,
    ListFilesResponse,
    ListProjectsResponse,
    RequestResult,
    RichProject,
    Rpi,
    UploadFileResponse,
    CompileSuccessPdfResponse,
    PdfPosition,
    ProgramDocumentPosition,
} from '../../model/rpi';

async function requestWrapper<T>(
    request: () => Promise<AxiosResponse>
): Promise<RequestResult<T>> {
    try {
        const response = await request();
        return {
            code: response.status,
            body: response.data,
            isOk: response.status < 300,
            isUnauth: false,
            isForbidden: false,
        };
    } catch (error: unknown) {
        const axiosError = error as AxiosError;
        return {
            code: axiosError?.response?.status || 500,
            body: axiosError?.response?.data as T,
            isOk: false,
            isUnauth: axiosError?.response?.status === 401,
            isForbidden: axiosError?.response?.status === 403,
        };
    }
}

function withIds(program: Program): Program {
    return {
        segments: program.segments.map(
            (s, index) =>
                ({
                    type: s.type,
                    text: s.text,
                    parameters: s.parameters,
                    id: index + 1,
                }) as Segment
        ),
        parameters: program.parameters,
    };
}

export class WebRpi implements Rpi {
    updateProjectTagsRequest(
        projectId: string,
        tags: Record<string, string>
    ): Promise<RequestResult> {
        return requestWrapper(async () =>
            axios.post(URLS.updateProjectTags.replace('{id}', projectId), {
                tags,
            })
        );
    }
    setProjectTypeRequest(
        projectId: string,
        type: ProjectType
    ): Promise<RequestResult> {
        return requestWrapper(async () =>
            axios.post(
                `${URLS.setType.replace('{id}', projectId)}?type=${type}`
            )
        );
    }
    pdfCompilationRequest(
        program: Program
    ): Promise<RequestResult<CompilationResponse>> {
        return requestWrapper(async () =>
            axios.post(URLS.compilePdf, withIds(program))
        );
    }
    async compilationRequest(
        program: Program
    ): Promise<RequestResult<CompileSuccessResult | CompileErrorResultList>> {
        return requestWrapper(async () =>
            axios.post(URLS.compile, withIds(program))
        );
    }

    async contactFormRequest(
        subject: string,
        body: string
    ): Promise<RequestResult> {
        return requestWrapper(async () =>
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
        return requestWrapper(async () =>
            axios.post(URLS.compileProject.replace('{id}', projectId))
        );
    }

    async compileProjectPdfRequest(
        projectId: string
    ): Promise<RequestResult<CompileSuccessPdfResponse>> {
        return requestWrapper(async () =>
            axios.post(URLS.compileProjectPdf.replace('{id}', projectId))
        );
    }

    async navigationDocToPdfRequest(
        projectId: string,
        position: ProgramDocumentPosition
    ): Promise<RequestResult<PdfPosition>> {
        return requestWrapper(async () =>
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
        return requestWrapper(async () =>
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
        return requestWrapper(async () =>
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
        return requestWrapper(async () =>
            axios.delete(
                `${URLS.deleteFile.replace('{id}', projectId)}?name=${name}`
            )
        );
    }

    async listFilesRequest(
        projectId: string
    ): Promise<RequestResult<ListFilesResponse>> {
        return requestWrapper(async () =>
            axios.get(`${URLS.filesGetList.replace('{id}', projectId)}`)
        );
    }

    async setTitleRequest(
        projectId: string,
        title: string
    ): Promise<RequestResult> {
        return requestWrapper(async () =>
            axios.post(
                `${URLS.setTitle.replace('{id}', projectId)}?name=${title}`
            )
        );
    }

    async getDefaultProjectRequest(
        lang: string,
        program: Program
    ): Promise<RequestResult<RichProject>> {
        return requestWrapper(async () =>
            axios.post(URLS.getDefaultProject, withIds(program), {
                headers: {
                    'Accept-Language': lang || 'en',
                },
            })
        );
    }

    async getProjectRequest(
        projectId: string
    ): Promise<RequestResult<RichProject>> {
        return requestWrapper(async () =>
            axios.get(URLS.getProject.replace('{id}', projectId))
        );
    }

    async renameFileRequest(
        oldName: string,
        newName: string,
        projectId: string
    ): Promise<RequestResult> {
        return requestWrapper(async () =>
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
        return requestWrapper(async () =>
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
        return requestWrapper(async () =>
            axios.delete(
                `${URLS.deleteFolder.replace('{id}', projectId)}?path=${encodeURIComponent(pathParam)}`
            )
        );
    }

    async getAllProjectsRequest(): Promise<
        RequestResult<ListProjectsResponse>
    > {
        return requestWrapper(async () => axios.get(URLS.getAllProjects));
    }

    async createProjectRequest(
        projectName: string,
        program: Program
    ): Promise<RequestResult<Project>> {
        return requestWrapper(async () =>
            axios.put(
                `${URLS.createProject}?name=${projectName}`,
                withIds(program)
            )
        );
    }

    async cloneProjectRequest(
        projectId: string
    ): Promise<RequestResult<Project>> {
        return requestWrapper(async () =>
            axios.post(`${URLS.cloneProject.replace('{id}', projectId)}`)
        );
    }

    async deleteProjectRequest(projectId: string): Promise<RequestResult> {
        return requestWrapper(async () =>
            axios.delete(URLS.deleteProject.replace('{id}', projectId))
        );
    }

    async saveProgramRequest(
        projectId: string,
        program: Program
    ): Promise<RequestResult> {
        return requestWrapper(async () =>
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
        return requestWrapper(async () =>
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
        return requestWrapper(() =>
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
        return requestWrapper(() =>
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
        return requestWrapper(() =>
            axios.post(URLS.Password, null, {
                params: { email, code, password, registration },
            })
        );
    }

    async getUserInfoRequest(): Promise<RequestResult<UserInfo>> {
        return requestWrapper(() => axios.get(URLS.UserInfo));
    }

    async getS3FileRequest(path: string): Promise<RequestResult> {
        return requestWrapper(() => axios.get(URLS.S3File + path));
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
        return requestWrapper(() => axios.post(URLS.FormLogin, params));
    }

    async oauthCodeRequest(
        code: string,
        state: string
    ): Promise<RequestResult> {
        return requestWrapper(() =>
            axios.get(URLS.OauthCode + '/provider', {
                params: {
                    code: code,
                    state: state,
                },
            })
        );
    }

    async logoutRequest(): Promise<RequestResult> {
        return requestWrapper(() => axios.post(URLS.Logout));
    }

    async promptProjectRequest(
        projectId: string,
        prompt: string
    ): Promise<RequestResult<Program>> {
        return requestWrapper(() =>
            axios.post(URLS.projectPrompt.replace('{id}', projectId), null, {
                params: { prompt },
            })
        );
    }

    async unauthorizedPromptProjectRequest(
        program: Program,
        prompt: string
    ): Promise<RequestResult<Program>> {
        return requestWrapper(() =>
            axios.post(URLS.unauthorizedPrompt, withIds(program), {
                params: { prompt },
            })
        );
    }

    async generateImageInProjectRequest(
        projectId: string,
        prompt: string
    ): Promise<RequestResult<Program>> {
        return requestWrapper(() =>
            axios.post(
                URLS.generateImageInProjectPrompt.replace('{id}', projectId),
                null,
                {
                    params: { prompt },
                }
            )
        );
    }
}
