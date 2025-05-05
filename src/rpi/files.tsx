import { requestWrapper } from './index.tsx';
import axios from 'axios';
import { URLS } from '../shared/urls';

export async function uploadFileRequest(formData, projectId, name) {
    return requestWrapper(async () =>
        axios.put(
            `${URLS.uploadFile.replace('{id}', projectId || '')}`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Accept: '*/*',
                },
                params: {
                    name: name,
                },
            }
        )
    );
}

export async function deleteFileRequest(name, projectId) {
    return requestWrapper(async () =>
        axios.delete(
            `${URLS.deleteFile.replace('{id}', projectId)}?name=${name}`
        )
    );
}

export async function listFilesRequest(projectId) {
    return requestWrapper(async () =>
        axios.get(`${URLS.filesGetList.replace('{id}', projectId)}`)
    );
}
