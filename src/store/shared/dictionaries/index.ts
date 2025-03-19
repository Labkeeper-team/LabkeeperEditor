import { CompileError } from "../../../shared/models/project";
import { en } from "./en";
import { ru } from "./ru";

export type Language = 'ru' | 'en';

export interface Translations {
    or: string;
    login: string;
    exit: string;
    delete: string;
    run: string;
    loading: string;
    yes: string;
    no: string;


    warning_dontuselongvarioables: string;

    label_add_markdown: string;
    label_add_code: string;
    label_save_to_pdf: string;
    label_problems: string;

    segment_divider: {
        add: string;
        computation: string;
        markdown: string;
    };

    interface_tour: {
        label: string;
        info_history_button: string;
        info_computed_segment: string;
        info_project_settings: string;
        info_run: string;
        info_result: string;
        info_pdf: string;
        info_error: string;
        info_add_markdown: string;
        info_canvas: string;
    },
    label_no_result_part1: string;
    label_no_result_part2: string;  //Add the code or markdown and click "RUN"
    delete_modal: string;
    create_modal: {
        label: string;
        create: string;
        name: string;
        error: {
            empty_name: string;
            too_many_projects: string;
        };
    }
    rounding_mode: {
        label: string;
        without_round: string;
        first_digit: string;
        fixed_number: string;
    }
    label_syntax_highlight: string;
    label_autocompilation: string;

    placeholder_search: string;
    projects: {
        label: string;
        title: string;
        last_modified: string;
        add: string;
        errors: {
            empty_name: string;
        }
    }
    segment: {
        code: string;
        markdown: string;
        visible: string;
        hide_assignment_with_values: string;
        hide_array: string;
        hide_general_formula: string;
        hide_infl_assignment: string;
        hide_infl_assignment_with_values: string;
        errors: {
            non_authorized_paste_image: string;
        }
    };

    instructions: {
        label: string;
        adding_segment: string;
    },
    
    compile_error: {
        [CompileError.CODE_NO_END_QUOTES]: string;
        [CompileError.UNKNOWN_SYMBOL]: string;
        [CompileError.QUOTA_EXCEEDED]: string;
        [CompileError.OPERATOR_EXPECTED]: string;
        [CompileError.NUMBER_EXPECTED]: string;
        [CompileError.NAME_EXPECTED]: string;
        [CompileError.NO_SUCH_VARIABLE]: string;
        [CompileError.STRING_ARGUMENT_EXPECTED]: string;
        [CompileError.ARRAY_ARGUMENT_EXPECTED]: string;
        [CompileError.NO_SUCH_FUNCTION]: string;
        [CompileError.ARITHMETIC_ERROR]: string;
        [CompileError.CANCELED]: string;
        [CompileError.NOT_ENOUGH_WORKERS]: string;
        [CompileError.INCORRECT_LEAST_SQUARES_ARGUMENT_SIZE]: string;
        [CompileError.VARIABLE_INSERT_ERROR]: string;
    }

    error_common: {
        segment: string;
        line: string;
        operator_expected: string;
        now: string;
        max: string;
        new_line: string;
        variable: string;
    }
    authorization: {
        title: string;
        loginVia: string;
        loginAndPasswoord: string;
        login: string;
        password: string;
        registration: string;
        forgotPassword: string;
        sendCode: string;
        confirmCode: string;
        resendCode: string;
        save: string;
        confirmPassword: string;
        alreadyHaveAccount: string;
        createAccount: string;
        continue: string;
        views: {
            email: string;
            code: string;
            password: string;
            success: string;
            emailSubtitle: string;
            codeSubtitle: string;
            passwordSubtitle: string;
            successSubtitle: string;
        };
        errors: {
            userExists: string;
            userNotFound: string;
            invalidEmail: string;
            invalidCode: string;
            passwordsDontMatch: string;
            fillAllFields: string;
            passwordSetError: string;
            credentialsError: string;
            oauthError: string;
        };
    },
    loginModal: {
        submit: string;
        loginToProceed: string;
        description: string;
    }
    quota_definition: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
        6: string;
    }

    filemanager: {
        title: string;
        add: string;
        dropzoneTitle: string;
        delete: string;
        edit: string;
        your_files: string;
        system_files: string;
        errors: {
            tooMuchFiles: string;
            tooBigFile: string;
            sessionExpired: string,
            internalError: string
            notSupported: string;
        }
    }

}

export const dictionary: Record<Language, Translations> = {
    'ru': ru,
    'en': en,
}