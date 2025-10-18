export const BUILD_INFO = __BUILD_INFO__ as unknown as BuildInfo;

export interface BuildInfo {
    major: string;
    minor: string;
}

const version = `v${BUILD_INFO.major}`;
const uri = '';
export const URLS = {
    compile: `${uri}/api/${version}/public/compile`,
    compileProject: `${uri}/api/${version}/public/project/{id}/compile`,
    compileProjectPdf: `${uri}/api/${version}/public/project/{id}/compile/pdf`,
    getAllProjects: `${uri}/api/${version}/public/project/all`,
    getDefaultProject: `${uri}/api/${version}/public/project/default`,
    createProject: `${uri}/api/${version}/public/project/create`,
    cloneProject: `${uri}/api/${version}/public/project/{id}/clone`,
    deleteProject: `${uri}/api/${version}/public/project/{id}/delete`,
    getProject: `${uri}/api/${version}/public/project/{id}/get`,
    setProgram: `${uri}/api/${version}/public/project/{id}/program`,
    setTitle: `${uri}/api/${version}/public/project/{id}/title`,
    setVisibility: `${uri}/api/${version}/public/project/{id}/visibility`,

    filesGetList: `${uri}/api/${version}/public/project/{id}/file/list`,
    uploadFile: `${uri}/api/${version}/public/project/{id}/file/upload`,
    renameFile: `${uri}/api/${version}/public/project/{id}/file/rename`,
    deleteFile: `${uri}/api/${version}/public/project/{id}/file/delete`,

    UserInfo: `${uri}/api/${version}/public/user-info`,
    S3File: `https://files.labkeeper.io/`,
    Email: `${uri}/api/${version}/public/email`,
    Code: `${uri}/api/${version}/public/code`,
    Password: `${uri}/api/${version}/public/password`,
    Contact: `${uri}/api/${version}/public/contact`,

    FormLogin: `${uri}/api/${version}/sec/formlogin`,
    OauthCode: `${uri}/api/${version}/sec/login/oauth2/code`,
    YandexOidcLogin: `${uri}/api/${version}/sec/oauth2/authorization/yandex`,
    Logout: `/api/${version}/sec/logout`,
};

type SecretsShape = {
    yandexCaptchaSiteKey: string;
    sentryDsn: string;
    yandexMetrikaKey: string;
};

declare global {
    interface Window {
        __SECRETS__?: Partial<SecretsShape>;
    }
}

const DEFAULT_SECRETS: SecretsShape = {
    yandexCaptchaSiteKey: '',
    sentryDsn: '',
    yandexMetrikaKey: '',
};

export const Secrets: SecretsShape = {
    ...DEFAULT_SECRETS,
    ...(typeof window !== 'undefined' && window.__SECRETS__
        ? window.__SECRETS__
        : {}),
};

export const Providers = ['yandex'];
