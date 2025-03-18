import axios from "axios";
import {requestWrapper, RequestResult} from "./index";

interface CodeValidationResponse {
    valid: boolean;
}

const debug = true

export const userRPI = {
    sendEmailWithCode: async (email: string, registration: boolean): Promise<RequestResult> => {
        if (debug) {
            console.log('sendEmailWithCode', email, registration)
            return {
                code: 200,
                body: {},
                isOk: true,
                isUnauth: false,
                isForbidden: false
            }
        }
        return requestWrapper(() => 
            axios.post('/email', null, {
                params: { email, registration }
            })
        );
    },

    checkCode: async (email: string, code: string): Promise<RequestResult> => {
        if (debug) {
            console.log('checkCode', email, code)
            return {
                code: 200,
                body: {
                    valid: true
                },
                isOk: true,
                isUnauth: false,
                isForbidden: false
            }
        }
        return requestWrapper(() => 
            axios.post<CodeValidationResponse>('/code', null, {
                params: { email, code }
            })
        );
    },

    setPassword: async (email: string, code: string, password: string, registration: boolean): Promise<RequestResult> => {
        if (debug) {
            console.log('setPassword', email, code, password, registration)
            return {
                code: 200,
                body: {},
                isOk: true,
                isUnauth: false,
                isForbidden: false
            }
        }
        return requestWrapper(() =>
            axios.post('/password', null, {
                params: { email, code, password, registration }
            })
        );
    }
}
