import axios from "axios";
import {URLS} from "../shared/urls";
import {RequestResult, requestWrapper} from "./index.tsx";

export async function setTitleRequest(projectId, title) : Promise<RequestResult> {
    return requestWrapper(async () => axios.post(
        `${URLS.setTitle.replace('{id}', projectId || '')}?name=${title}`
    ));
}

export async function getDefaultProjectRequest() : Promise<RequestResult> {
    return requestWrapper(async () => axios.post(URLS.getDefaultProject))
}

export async function getProjectRequest(projectId) : Promise<RequestResult> {
    return requestWrapper(async () => axios.get(URLS.getProject.replace('{id}', projectId)))
}

export async function renameFileRequest(oldName, newName, projectId) {
    return requestWrapper(async () => axios.post(`${URLS.renameFile.replace('{id}', projectId )}?old=${oldName}&new=${newName}`))
}

export async function getAllProjectsRequest() {
    return requestWrapper(async () => axios.get(URLS.getAllProjects))
}

export async function createProjectRequest(projectName, emptyProject) {
    return requestWrapper(async () => axios.put(
        `${URLS.createProject}?name=${projectName}`,
        emptyProject
    ))
}

export async function deleteProjectRequest(projectId) {
    return requestWrapper(async () => axios.delete(URLS.deleteProject.replace('{id}', projectId)))
}

export async function saveProgramRequest(projectId, program) {
    return requestWrapper(async () => axios.post(URLS.setProgram.replace(
        '{id}',
        projectId
    ), program))
}