import { BUILD_INFO } from '../version';

const version = `v${BUILD_INFO.major}`;

export const URLS = {
    compile: `/api/${version}/public/compile`,
    compileProject: `/api/${version}/public/project/{id}/compile`,
    getAllProjects: `/api/${version}/public/project/all`,
    getDefaultProject: `/api/${version}/public/project/default`,
    createProject: `/api/${version}/public/project/create`,
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
    Email: `/api/${version}/public/email`,
    Code: `/api/${version}/public/code`,
    Password: `/api/${version}/public/password`,
};
