import axios from "axios";
import {requestWrapper, RequestResult} from "./index";

interface CodeValidationResponse {
    valid: boolean;
}

export const userRPI = {
    sendEmailWithCode: async (email: string, registration: boolean): Promise<RequestResult> => {
        return requestWrapper(() => 
            axios.post('/email', null, {
                params: { email, registration }
            })
        );
    },

    checkCode: async (email: string, code: string): Promise<RequestResult> => {
        return requestWrapper(() => 
            axios.post<CodeValidationResponse>('/code', null, {
                params: { email, code }
            })
        );
    },

    setPassword: async (email: string, code: string, password: string, registration: boolean): Promise<RequestResult> => {
        return requestWrapper(() => 
            axios.post('/password', null, {
                params: { email, code, password, registration }
            })
        );
    }
}
