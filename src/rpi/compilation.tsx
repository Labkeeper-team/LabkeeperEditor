import {requestWrapper} from "./index.tsx";
import axios from "axios";
import {URLS} from "../shared/urls";

export async function compilationRequest(program) {
    return requestWrapper(async () => axios.post(URLS.compile, program))
}

export async function compileProjectRequest(projectId) {
    return requestWrapper(async () => axios.post(URLS.compileProject.replace(
        '{id}',
        projectId?.toString() || '-1'
    )))
}