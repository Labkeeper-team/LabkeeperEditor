export const BUILD_INFO = __BUILD_INFO__ as unknown as BuildInfo;

export interface BuildInfo {
    major: string;
    minor: string;
}

const version = `v${BUILD_INFO.major}`;

export const URLS = {
    compile: `/api/${version}/public/compile`,
    compileProject: `/api/${version}/public/project/{id}/compile`,
    getAllProjects: `/api/${version}/public/project/all`,
    getDefaultProject: `/api/${version}/public/project/default`,
    createProject: `/api/${version}/public/project/create`,
    cloneProject: `/api/${version}/public/project/{id}/clone`,
    deleteProject: `/api/${version}/public/project/{id}/delete`,
    getProject: `/api/${version}/public/project/{id}/get`,
    setProgram: `/api/${version}/public/project/{id}/program`,
    setTitle: `/api/${version}/public/project/{id}/title`,
    setVisibility: `/api/${version}/public/project/{id}/visibility`,

    filesGetList: `/api/${version}/public/project/{id}/file/list`,
    uploadFile: `/api/${version}/public/project/{id}/file/upload`,
    renameFile: `/api/${version}/public/project/{id}/file/rename`,
    deleteFile: `/api/${version}/public/project/{id}/file/delete`,

    UserInfo: `/api/${version}/public/user-info`,
    S3File: `https://files.labkeeper.io/`,
    Email: `/api/${version}/public/email`,
    Code: `/api/${version}/public/code`,
    Password: `/api/${version}/public/password`,
    Contact: `/api/${version}/public/contact`,

    FormLogin: `/api/${version}/sec/formlogin`,
    OauthCode: `/api/${version}/sec/login/oauth2/code`,
    YandexOidcLogin: `/api/${version}/sec/oauth2/authorization/yandex`,
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
