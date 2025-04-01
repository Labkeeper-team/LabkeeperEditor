export async function requestWrapper(request) : Promise<RequestResult> {
    try {
        const response = await request()
        return {
            code: response.status,
            body: response.data,
            isOk: response.status < 300,
            isUnauth: false,
            isForbidden: false
        }
    } catch (error: any) {
        return {
            code: error.response?.status || 500,
            body: error.response?.data || null,
            isOk: false,
            isUnauth: error.response?.status === 401,
            isForbidden: error.response?.status === 403
        }
    }
}

export interface RequestResult {
    body: any,
    code: number,
    isOk: boolean,
    isUnauth: boolean,
    isForbidden: boolean
}