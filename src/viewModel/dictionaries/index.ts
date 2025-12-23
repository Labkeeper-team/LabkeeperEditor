import { CompileError } from '../../model/domain.ts';
import { en } from './en.ts';
import { ru } from './ru.ts';

export type Language = 'ru' | 'en';

export interface Translations {
    or: string;
    login: string;
    exit: string;
    delete: string;
    run: string;
    loading: string;
    no_comp_segment: string;
    add_segment: string;
    yes: string;
    no: string;

    warning_dontuselongvarioables: string;

    label_add_latex: string;
    label_add_asciimath: string;
    label_add_markdown: string;
    label_add_markdown_short: string;
    label_add_more: string;
    label_add_more_short: string;
    label_add_code: string;
    label_save_to_pdf: string;
    label_problems: string;

    short_segment: {
        md: string;
        computational: string;
        latex: string;
        asciimath: string;
    };

    segment_divider: {
        add: string;
        computation: string;
        markdown: string;
        latex: string;
        asciimath: string;
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
    };
    label_no_result_part1: string;
    label_no_result_part2: string; //Add the code or markdown and click "RUN"
    delete_modal: string;
    create_modal: {
        label: string;
        create: string;
        name: string;
        error: {
            empty_name: string;
            too_many_projects: string;
        };
    };
    rounding_mode: {
        label: string;
        without_round: string;
        first_digit: string;
        five_digits: string;
        one_digit: string;
        two_digits: string;
        three_digits: string;
    };
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
            sessionExpiredReload: string;
        };
    };
    segment: {
        code: string;
        markdown: string;
        latex: string;
        asciimath: string;
        visible: string;
        hide_assignment_with_values: string;
        hide_array: string;
        hide_value: string;
        hide_assignment: string;
        hide_infl: string;
        hide_general_formula: string;
        hide_infl_assignment: string;
        hide_infl_assignment_with_values: string;
        errors: {
            non_authorized_paste_image: string;
        };
        no_computation_result: string;
        run_to_view: string;
    };

    instructions: {
        label: string;
        adding_segment: string;
    };

    viewer: {
        mode: {
            markdown: string;
            latex: string;
        };
    };

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
        [CompileError.INCORRECT_ARGUMENTS_COUNT]: string;
        [CompileError.VARIABLE_INSERT_ERROR]: string;
        [CompileError.FILE_USAGE_NOT_ALLOWED]: string;
        [CompileError.TOO_MUCH_FILES]: string;
        [CompileError.INCORRECT_ARGUMENT_SIZE]: string;
        [CompileError.INCORRECT_ARGUMENT]: string;
        [CompileError.FUNCTION_HAS_NO_RETURN_VALUE]: string;
        [CompileError.MULTIPLE_ERROR]: string;
        [CompileError.LOGIN_REQUIRED]: string;
        [CompileError.LATEX_ERROR]: string;
        [CompileError.NAME_RESERVED]: string;
        [CompileError.INCORRECT_INFL_DEFINITION_ARRAY_SIZE]: string;
        [CompileError.INCORRECT_INFL_DEFINITION_VALUE_WITH_INFL]: string;
        [CompileError.ARRAY_HAVE_ONLY_ZERO_VALUES]: string;
    };

    error_common: {
        segment: string;
        line: string;
        operator_expected: string;
        now: string;
        max: string;
        new_line: string;
        variable: string;
    };
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
            unknownError: string;
        };
    };
    loginModal: {
        submit: string;
        loginToProceed: string;
        description: string;
    };
    quota_definition: {
        1: string;
        2: string;
        3: string;
        4: string;
        5: string;
        6: string;
    };

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
            sessionExpired: string;
            noNetwork: string;
            internalError: string;
            notSupported: string;
            notEnoughRights: string;
            notFound: string;
            bad_name: string;
        };
    };

    share_modal: {
        title: string;
        private_access: string;
        public_access: string;
        copy_link: string;
        link_copied: string;
        copy_error: string;
    };
    delete_files_modal: {
        title: string;
    };
    wiki: string;
    readonly_public_project: string;
    clone: string;
    contact_modal: {
        button: string;
        title: string;
        contact_email: string;
        contact_form: string;
        subject: string;
        subject_placeholder: string;
        message: string;
        message_placeholder: string;
        send: string;
        cancel: string;
        warn: string;
        err: string;
    };
    contact_ok: string;
    contact_error: string;
}

export const dictionary: Record<Language, Translations> = {
    ru: ru,
    en: en,
};
