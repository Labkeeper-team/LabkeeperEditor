import { Translations } from './index.ts';
import { CompileError } from '../../model/domain.ts';
export const en: Translations = {
    or: 'or',
    login: 'Login',
    exit: 'Exit',
    delete: 'Delete',
    run: 'Run',
    loading: 'Loading',
    yes: 'Yes',
    no: 'No',
    add_segment: 'Add code to run your program',
    no_comp_segment: 'Add computation segment to run',

    warning_dontuselongvarioables: 'Do not use long name variables',

    label_add_asciimath: 'Simple-math',
    label_add_markdown: 'Markdown',
    label_add_markdown_short: 'MD',
    label_add_code: 'Computation',
    label_add_latex: 'Latex',
    label_add_more: 'Add',
    label_add_more_short: 'More',
    label_save_to_pdf: 'Save to PDF',
    label_problems: 'Problems',

    short_segment: {
        md: 'Markdown',
        computational: 'Computation',
        latex: 'Latex',
        asciimath: 'Simple-formula',
    },

    segment_divider: {
        add: 'Add',
        computation: 'computation',
        markdown: 'markdown',
        latex: 'latex',
        asciimath: 'simple-math',
    },
    latex_boundary: {
        header: 'LaTeX heading',
        footer: 'LaTeX footer',
        insert_hint: 'Click to insert an editable segment',
    },

    interface_tour: {
        label: 'Interface tour',
        info_history_button:
            'History buttons are necessary to navigate to older versions of the code',
        info_computed_segment:
            'You can add a computed segment.\nIn it, you can create variables, execute functions, and evaluate expressions.\nThe computation results will appear in the segments on the right.',
        info_project_settings:
            'Configure your project by selecting from the available options',
        info_run:
            'This button starts the computation process.\nFormulas and functions from your segments on the left are computed and rendered on the right.',
        info_result:
            'The execution and rendering result of your code.\nHere, you will find computation results, formulas, and graphs.',
        info_pdf:
            'If you want to save or print the computation results, you can convert them to a PDF.',
        info_error: 'A list of errors found in your code during compilation.',
        info_add_markdown:
            'You can add a segment with markdown text.\nVariable values can also be inserted using ${NAME}.',
        info_canvas:
            'This is where the segments that make up your program are located.',
    },
    label_no_result_part1: 'Add the code or markdown',
    label_no_result_part2: 'and click "RUN"', //Add the code or markdown and click "RUN"
    delete_modal: 'Are you sure want to delete',
    create_modal: {
        label: 'Creating a new project',
        create: 'Create',
        name: 'Project name',
        project_type: 'Project type',
        type_markdown: 'Markdown',
        type_latex: 'LaTeX',
        error: {
            empty_name: 'Please input the project name',
            too_many_projects: 'Too many projects',
        },
    },
    rounding_mode: {
        label: 'Rounding mode',
        without_round: 'Without rounding',
        first_digit: 'First significant digit of the error',
        five_digits: 'Five digits',
        one_digit: 'One digit',
        two_digits: 'Two digits',
        three_digits: 'Three digits',
    },
    label_syntax_highlight: 'Syntax highlighting',
    label_autocompilation: 'Autocompilation',

    placeholder_search: 'Enter text to search',
    projects: {
        label: 'Projects',
        title: 'Name',
        last_modified: 'Last modified',
        add: 'Add',
        errors: {
            empty_name: 'The name must not be empty or consist only of spaces.',
            sessionExpiredReload: 'Session expired. Please reload the page',
        },
    },
    segment: {
        code: 'code',
        markdown: 'markdown',
        visible: 'Visible',
        hide_assignment_with_values: 'Hide a formula with substituted numbers',
        hide_array: 'Hide array',
        hide_general_formula:
            'Hide the general partial differential error formula',
        hide_infl_assignment: 'Hide the error formula',
        hide_infl_assignment_with_values:
            'Hide the error formula with substituted numbers',
        errors: {
            non_authorized_paste_image: 'You need authorize to paste images',
        },
        latex: 'latex',
        asciimath: 'simple-math',
        no_computation_result: 'No computation result',
        run_to_view: 'Press the run button to see computations',
        hide_assignment: 'Hide the main formula used for calculations',
        hide_value: 'Hide the final numeric result',
        hide_infl: 'Hide the final error result',
    },

    instructions: {
        adding_segment: 'Adding a segment',
        label: 'Instructions',
    },

    viewer: {
        no_pdf: 'Click the "Run" button to display the PDF file.',
        pdf_loading: 'Loading PDF…',
        gpt_prompt_button: 'GPT',
        mode: {
            label: 'Project type',
            markdown: 'markdown',
            latex: 'latex',
        },
    },
    synctex: {
        to_pdf: 'Go to PDF',
        to_editor: 'Go to source',
        errors: {
            no_pdf: 'Compile the project to sync with the PDF.',
            no_cursor: 'Place the cursor in a segment first.',
            no_pdf_selection: 'Click in the PDF to choose a position.',
            failed: 'Could not sync position. Recompile and try again.',
            locked: 'The PDF is being processed. Please try again shortly.',
        },
    },
    header_menu: {
        menu: 'Menu',
        examples: 'Project examples',
        privacy_policy: 'Privacy policy',
        tokens: 'Tokens',
        top_up_balance: 'Top up balance',
        about: 'About us',
        contact_us: 'Contact us',
        my_projects: 'My projects',
        logout: 'Log out',
        logout_confirmation: 'Are you sure you want to log out?',
    },
    tokens_page: {
        title: 'Top up your token balance',
        subtitle:
            'Tokens power computations, AI generation, and other resource-heavy Labkeeper features.',
        balance_title: 'Your balance',
        balance_caption: 'Tokens available',
        unauth_balance_caption:
            'Log in to view your balance and purchase tokens.',
        buy_title: 'Choose a package',
        buy_subtitle:
            'Purchasing is prepared as a mock flow for now; payment will be connected separately.',
        buy_section_headline_lead: 'One balance',
        buy_section_headline_rest: 'for all your tasks',
        buy_section_intro:
            'Labkeeper uses a transparent token system. Tokens are the platform’s universal currency: you can allocate resources flexibly for whatever your project needs right now — from AI-assisted content generation to heavy server-side computation. You pay only for what you actually use.',
        buy_packages_heading: 'Top-up options:',
        authenticated_buy_balance_prefix: 'Your balance',
        package_quantity_label: 'Token amount',
        package_card_subline_template: '{tokens} for {price}',
        pricing_loading: 'Loading current prices...',
        pricing_error:
            'Could not load current prices. Try refreshing the page.',
        pricing_empty: 'No token packages are available right now.',
        buy_button: 'Buy',
        popular: 'Popular',
        tokens_amount: 'tokens',
        usage_title: 'What tokens are used for',
        usage_items: [
            {
                heading: 'AI assistant (GPT) usage',
                body: 'Ask the model to outline a document, convert text to Markdown, or spot bugs in your code.',
            },
            {
                heading: 'Image generation',
                body: 'Create unique illustrations and graphics for papers and lab reports from a single prompt.',
            },
            {
                heading: 'Server-side compilation',
                body: 'Build heavy PDF documents without freezes. Tokens are charged only while the powerful remote compiler is running.',
            },
        ],
        usage_rates: {
            latex_compilation:
                'LaTeX compilation: {tokens} per 1 second of server time.',
            markdown_compilation:
                'Markdown compilation: {tokens} per 1 second of server time.',
            gpt_text_prompt: 'Text GPT prompt: {tokens} per 1 request.',
            gpt_image_prompt: 'Image generation: {tokens} per 1 request.',
        },
        modal: {
            title: 'Token purchase',
            gateway_notice:
                'Payment is processed via the secure YuKassa payment gateway',
            consent_offer_prefix:
                'By clicking the “Proceed to payment” button, you accept the ',
            consent_offer_link: 'Public Offer',
            consent_privacy_prefix:
                'By clicking “Proceed to payment”, you consent to ',
            consent_privacy_link: 'the processing of personal data',
            consent_privacy_policy_prefix:
                'By clicking “Proceed to payment”, you agree to the ',
            consent_privacy_policy_link: 'Privacy Policy',
            pay_button: 'Proceed to payment',
            mock_notice:
                'Payment is not available yet: this button is a mock placeholder.',
        },
        navigation: {
            advantages: 'Advantages',
            features: 'Features',
            for_whom: 'For whom',
            examples: 'Project examples',
            tokens: 'Tokens',
            about: 'About us',
            login: 'Login',
            logout: 'Log out',
            editor: 'Editor',
            projects: 'My projects',
        },
        footer: {
            copyright: `© 2024—${new Date().getFullYear()}`,
            wiki_nav: 'Documentation',
            nav_aria: 'Marketing site navigation',
            contact_label: 'Contact',
        },
    },
    compile_error: {
        [CompileError.CODE_NO_END_QUOTES]: 'No closing quotes',
        [CompileError.UNKNOWN_SYMBOL]: 'Unknown symbol',
        [CompileError.QUOTA_EXCEEDED]: 'Quota exceeded',
        [CompileError.OPERATOR_EXPECTED]: 'Operator expected',
        [CompileError.NUMBER_EXPECTED]: 'Number expected',
        [CompileError.NAME_EXPECTED]: 'Variable name expected',
        [CompileError.NO_SUCH_VARIABLE]: 'No such variable',
        [CompileError.STRING_ARGUMENT_EXPECTED]: 'String argument expected',
        [CompileError.ARRAY_ARGUMENT_EXPECTED]: 'Array argument expected',
        [CompileError.NO_SUCH_FUNCTION]: 'No such function',
        [CompileError.ARITHMETIC_ERROR]: 'Division by zero error',
        [CompileError.CANCELED]: 'Computation canceled',
        [CompileError.NOT_ENOUGH_WORKERS]:
            'Not enough computational power on servers to compile',
        [CompileError.INCORRECT_ARGUMENTS_COUNT]:
            'Incorrect number of arguments in the function ',
        [CompileError.VARIABLE_INSERT_ERROR]:
            'Error inserting variable into md text',
        [CompileError.FILE_USAGE_NOT_ALLOWED]:
            'You may not use files unauthenticated',
        [CompileError.TOO_MUCH_FILES]: 'Too much files for one project',
        [CompileError.INCORRECT_ARGUMENT_SIZE]:
            'Incorrect array argument length in function',
        [CompileError.INCORRECT_ARGUMENT]:
            'Incorrect argument size in function',
        [CompileError.FUNCTION_HAS_NO_RETURN_VALUE]:
            'No return value in function',
        [CompileError.MULTIPLE_ERROR]: 'Multiple error',
        [CompileError.LOGIN_REQUIRED]: 'Login is required to proceed',
        [CompileError.NAME_RESERVED]:
            'E and PI can not be used as variable name',
        [CompileError.INCORRECT_INFL_DEFINITION_ARRAY_SIZE]:
            'The error cannot be set as an array',
        [CompileError.INCORRECT_INFL_DEFINITION_VALUE_WITH_INFL]:
            'The error should not be set to a value that already has an error',
        [CompileError.ARRAY_HAVE_ONLY_ZERO_VALUES]:
            'Array may not contain only zero values. Check array error and round mode.',
        [CompileError.LATEX_ERROR]: 'Latex error',
    },
    error_common: {
        segment: 'Segment',
        common_errors: 'General errors',
        line: 'line',
        operator_expected: 'Operator expected',
        now: 'Now',
        max: 'Max',
        new_line: 'New line',
        variable: 'Variable',
    },
    authorization: {
        title: 'Authorization',
        loginVia: 'Login via',
        loginAndPasswoord: 'Login and password',
        login: 'Login',
        loginInput: 'Login',
        password: 'Password',
        registration: 'Registration',
        forgotPassword: 'Forgot password?',
        sendCode: 'Send code',
        confirmCode: 'Confirm code',
        resendCode: 'Resend code',
        save: 'Save',
        confirmPassword: 'Confirm password',
        alreadyHaveAccount: 'Already have an account?',
        createAccount: 'Create account',
        continue: 'Continue',
        personalDataAgreement:
            'I consent to the processing of my personal data in accordance with',
        personalDataPolicyLink: 'the Personal Data Processing Policy',
        personalDataAgreementAnd: 'and',
        personalDataConsentLink: 'the Personal Data Processing Consent',
        views: {
            email: 'Enter your email',
            code: 'Enter the code',
            password: 'Set password',
            success: 'Success',
            emailSubtitle: 'We will send a verification code to your email',
            codeSubtitle: 'Enter the code we sent to your email',
            passwordSubtitle: 'Create a strong password for your account',
            successSubtitle: 'Your password has been successfully changed',
        },
        errors: {
            userExists: 'User with this email already exists',
            userNotFound: 'User not found',
            invalidEmail: 'Invalid email format',
            invalidCode: 'Invalid code',
            invalidPassword: 'Password must contain at least 8 characters',
            passwordsDontMatch: 'Passwords do not match',
            fillAllFields: 'Please fill in all fields',
            passwordSetError: 'Error setting password',
            credentialsError: 'Incorrect login or password',
            oauthError: 'Error while authenticating via third party provider',
            unknownError: 'Unknown error',
        },
    },
    loginModal: {
        submit: 'Login',
        loginToProceed: 'Login to proceed',
        description: 'You were logout, because your session expired',
    },
    quota_definition: {
        '1': 'Too many segments',
        '2': 'Too many exponential operators',
        '3': 'Too many characters',
        '4': 'Too many functions',
        '5': 'Constants are too large',
        '6': 'Program execution time exceeded',
    },
    filemanager: {
        title: 'Files',
        add: 'Add files',
        dropzoneTitle: 'Drop files here',
        root_folder: 'Your files',
        drop_to_root: 'Drop files to your files',
        drop_to_folder: 'Drop files to ${path}',
        upload_target: 'Upload to: ${path}',
        delete: 'Delete',
        edit: 'Edit',
        your_files: 'Your files',
        system_files: 'System files',
        create_folder: 'New folder',
        create_file: 'Create file',
        empty: 'No files yet',
        errors: {
            tooMuchFiles: 'Too much files for one project',
            tooBigFile: 'Too big file.Maximum is ${replace1} mb`',
            sessionExpired: 'Session has expired',
            notEnoughRights: "You don't have enough rights to view the project",
            internalError: 'Internal error.\nWe are working on it!',
            notSupported: 'Media type is not supported',
            notFound: 'Project not found',
            noNetwork: 'No connection with backend',
            bad_name: 'Name contains invalid characters or is too long',
            fileAlreadyExists: 'A file with this name already exists',
            rename_file_failed: 'Could not rename file. Please try again',
            rename_folder_failed: 'Could not rename folder. Please try again',
            upload_failed: 'Could not upload file. Please try again',
        },
    },
    share_modal: {
        title: 'Share to',
        private_access: 'Access is only for me',
        public_access: 'Access for everyone',
        copy_link: 'Copy the link for sharing',
        link_copied: 'Link copied to clipboard',
        copy_error: 'Failed to copy link',
    },
    delete_files_modal: {
        title: 'You removed all file links from your code. Do you want to delete the following files from the project?',
    },
    privacy_policy_acceptance_modal: {
        title: 'Privacy Policy',
        description_prefix:
            'To continue using the Labkeeper website, please read ',
        privacy_policy: 'the Privacy Policy',
        description_middle: ' and accept ',
        personal_data_consent: 'the Personal Data Processing Consent',
        description_suffix: '.',
        accept: 'Accept',
        error: 'Failed to save privacy policy acceptance. Please try again',
    },
    wiki: 'wiki',
    readonly_public_project: 'readonly public project',
    clone: 'Clone',
    contact_modal: {
        button: 'Contact us',
        title: 'Contact us',
        subject: 'Subject',
        subject_placeholder: 'Briefly describe the subject',
        message: 'Message',
        message_placeholder: 'Describe your question or suggestion',
        send: 'Send',
        cancel: 'Cancel',
        warn: 'Please fill in subject and message',
        err: 'Failed to open mail client',
        contact_email: 'Contact email',
        contact_form: 'Contact form',
        agreement_prefix: 'By contacting us, you acknowledge',
        privacy_policy: 'the Privacy Policy',
        agreement_and: 'and',
        personal_data_consent: 'the Personal Data Processing Consent',
    },

    prompt_modal: {
        title: 'Chat GPT prompt',
        description:
            'AI will process your request and add a new code segment in the right place in the project.',
        placeholder: 'Enter prompt',
        generateImage: 'Generate images',
        generateImageDescription:
            'When enabled, the bot will generate an IMAGE from your description and insert it into the project.',
        submit: 'Send',
        sending: 'Sending...',
        errors: {
            bad_request: 'Invalid request. Please check your input.',
            payment_required:
                'Your service usage limit for today has been reached. Please contact support to extend it.',
            unknownError: 'An unexpected error occurred',
        },
    },

    contact_ok: 'We have received your feedback',
    contact_error: 'An unexpected error has occurred',
};
