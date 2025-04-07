import { AxiosError } from 'axios';

export async function requestWrapper(request): Promise<RequestResult> {
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
            code: axiosError.response?.status || 500,
            body: axiosError.response?.data || null,
            isOk: false,
            isUnauth: axiosError.response?.status === 401,
            isForbidden: axiosError.response?.status === 403,
        };
    }
}

export interface RequestResult {
    body: unknown;
    code: number;
    isOk: boolean;
    isUnauth: boolean;
    isForbidden: boolean;
}
