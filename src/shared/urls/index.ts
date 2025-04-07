export const URLS = {
    compile: '/api/v2/public/compile',
    compileProject: '/api/v2/public/project/{id}/compile',
    getAllProjects: '/api/v2/public/project/all',
    getDefaultProject: '/api/v2/public/project/default',
    createProject: '/api/v2/public/project/create',
    deleteProject: '/api/v2/public/project/{id}/delete',
    getProject: '/api/v2/public/project/{id}/get',
    setProgram: '/api/v2/public/project/{id}/program',
    setTitle: '/api/v2/public/project/{id}/title',
    setVisibility: '/api/v2/public/project/{id}/visibility',

    filesGetList: '/api/v2/public/project/{id}/file/list',
    uploadFile: '/api/v2/public/project/{id}/file/upload',
    renameFile: '/api/v2/public/project/{id}/file/rename',
    deleteFile: '/api/v2/public/project/{id}/file/delete',
};
