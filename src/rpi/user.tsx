import axios from "axios";
import {requestWrapper, RequestResult} from "./index";
import {Routes} from "../routing/routes.ts";

interface CodeValidationResponse {
    valid: boolean;
}

const debug = false

export const userRPI = {
    sendEmailWithCode: async (email: string, registration: boolean, lang: string, captcha: string): Promise<RequestResult> => {
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
            axios.post(Routes.Email, null, {
                params: { email, registration, captcha },
                headers: {"Accept-Language": lang || 'en'}
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
            axios.post<CodeValidationResponse>(Routes.Code, null, {
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
            axios.post(Routes.Password, null, {
                params: { email, code, password, registration }
            })
        );
    }
}
