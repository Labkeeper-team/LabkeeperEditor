import { Translations } from './index.ts';
import { CompileError } from '../../model/domain.ts';

export const ru: Translations = {
    or: 'или',
    login: 'Войти',
    exit: 'Выход',
    delete: 'Удалить',
    run: 'Выполнить',
    loading: 'Выполнение',
    yes: 'Да',
    no: 'Нет',
    add_segment: 'Добавьте код для запуска программы',
    no_comp_segment:
        'Добавьте сегмент с вычислением, чтобы запустить программу',

    warning_dontuselongvarioables: 'Не используйте длинные имена переменных',

    label_add_asciimath: 'Простая формула',
    label_add_markdown: 'Маркдаун',
    label_add_markdown_short: 'MD',
    label_save_to_pdf: 'Сохранить в PDF',
    label_problems: 'Проблемы',
    label_add_code: 'Вычисление',
    label_add_latex: 'Latex',
    label_add_more: 'Добавить',
    label_add_more_short: 'Еще',

    short_segment: {
        md: 'Маркдаун',
        computational: 'Вычисление',
        latex: 'Latex',
        asciimath: 'Простая формула',
    },

    segment_divider: {
        add: 'Добавить',
        computation: 'Вычисления',
        markdown: 'Маркдаун',
        latex: 'Latex',
        asciimath: 'Простая формула',
    },
    latex_boundary: {
        header: 'LaTeX заголовок',
        footer: 'LaTeX футер',
        insert_hint: 'Нажмите, чтобы вставить редактируемый сегмент',
    },

    interface_tour: {
        label: 'Тур по интерфейсу',
        info_history_button:
            'Кнопки истории необходимы для перехода на более старые версии кода',
        info_computed_segment:
            'Вы можете добавить вычислительный сегмент.\nВ нем можно создавать переменные, выполнять функции и считать выражения.\nРезультат вычислений будет в сегментах справа.',
        info_project_settings:
            'Настройте свой проект, выбирая из предлагаемых параметров',
        info_run:
            'Кнопка запускает вычислительный процесс.\nФормулы и функции из ваших сегментов слева вычисляются и отрисовываются справа.',
        info_result:
            'Результат выполнения и прорисовки вашего кода.\nТут располагаются результаты вычислений, формулы, графики.',
        info_pdf:
            'Если вы хотите сохранить или распечатать результат вычислений, вы можете конвертировать его в pdf.',
        info_error:
            'Список ошибок, которые были обнаружены в вашем коде во время компиляции.',
        info_add_markdown:
            'Можно добавить сегмент с markdown-текстом.\nТакже доступны вставки значений переменных через ${NAME}.',
        info_canvas:
            'Здесь располагаются сегменты, из которых состоит ваша программа.',
    },
    label_no_result_part1: 'Добавьте код или маркдаун',
    label_no_result_part2: 'и нажмите "Выполнить"', //Add the code or markdown and click "RUN"
    delete_modal: 'Вы уверены, что хотите удалить',
    create_modal: {
        label: 'Создать новый проект',
        create: 'Создать',
        name: 'Имя проекта',
        project_type: 'Тип проекта',
        type_markdown: 'Markdown',
        type_latex: 'LaTeX',
        error: {
            empty_name: 'Введите имя проекта',
            too_many_projects: 'Слишком много проектов',
        },
    },
    rounding_mode: {
        label: 'Режим округления',
        without_round: 'Без округления',
        first_digit: 'Первая значащая цифра погрешности',
        five_digits: '5 знаков',
        one_digit: '1 знак',
        two_digits: '2 знака',
        three_digits: '3 знака',
    },
    label_syntax_highlight: 'Подсветка синтаксиса',
    label_autocompilation: 'Автокомпиляция',

    placeholder_search: 'Введите текст для поиска',
    projects: {
        label: 'Проекты',
        title: 'Имя',
        last_modified: 'Последнее изменение',
        add: 'Добавить',
        errors: {
            empty_name:
                'Имя не должно быть пустым или состоять только из пробелов',
            sessionExpiredReload:
                'Сессия истекла. Пожалуйста, перезагрузите страницу',
        },
    },
    segment: {
        code: 'код',
        markdown: 'маркдаун',
        visible: 'Показывать',
        hide_assignment_with_values: 'Скрыть формулу с подставленными числами',
        hide_array: 'Скрыть массив',
        hide_general_formula:
            'Скрыть общую формулу погрешности с частными производными',
        hide_infl_assignment: 'Скрыть формулу погрешности',
        hide_infl_assignment_with_values:
            'Скрыть формулу погрешности с подставленными числами',
        errors: {
            non_authorized_paste_image:
                'Что бы вставить изображение вам необходимо авторизоваться',
        },
        latex: 'latex',
        asciimath: 'простая формула',
        no_computation_result: 'Отсутствует результат вычислений',
        run_to_view: 'Нажмите кнопку "Выполнить"',
        hide_assignment:
            'Скрыть основную формулу по которой делаются вычисления',
        hide_value: 'Скрыть конечный числовой результат',
        hide_infl: 'Скрыть конечный результат погрешности',
    },

    instructions: {
        label: 'Помощь',
        adding_segment: 'Добавить сегмент',
    },

    viewer: {
        no_pdf: 'Нажмите кнопку  "Выполнить", для отображения PDF файла',
        pdf_loading: 'Загрузка PDF…',
        mode: {
            label: 'Тип проекта',
            markdown: 'markdown',
            latex: 'latex',
        },
    },
    synctex: {
        to_pdf: 'К PDF',
        to_editor: 'К коду',
        errors: {
            no_pdf: 'Сначала выполните проект, чтобы появился PDF.',
            no_cursor: 'Сначала установите курсор в сегменте или файле.',
            no_pdf_selection: 'Кликните в PDF, чтобы выбрать позицию.',
            failed: 'Не удалось синхронизировать позицию. Перекомпилируйте и попробуйте снова.',
            locked: 'PDF сейчас обрабатывается. Попробуйте ещё раз чуть позже.',
        },
    },
    header_menu: {
        menu: 'Меню',
        examples: 'Примеры проектов',
        privacy_policy: 'Политика конфиденциальности',
        tokens: 'Токены',
        top_up_balance: 'Пополнить баланс',
        about: 'О нас',
        contact_us: 'Связаться с нами',
        my_projects: 'Мои проекты',
        logout: 'Выход',
        logout_confirmation: 'Вы уверены, что хотите выйти?',
        share: 'Поделиться',
        language: 'Язык',
        change_language_to: 'Поменять язык на «{language}»',
    },
    agent_chat: {
        tab_label: 'Агент',
        pdf_tab_label: 'PDF',
        placeholder: 'Опишите, что сделать с проектом',
        send: 'Отправить',
        disclaimer: 'ИИ может ошибаться. Проверяйте сгенерированный код',
        result: 'Ответ',
        error: 'Ошибка',
        notice: 'Примечание',
        buy_tokens: 'Перейти к покупке токенов',
        clear_history: 'Очистить историю',
        history_loading: 'Загружаем историю',
        history_error: 'Не удалось загрузить историю',
        history_clear_error: 'Не удалось очистить историю. Попробуйте ещё раз',
        run_blocked: 'Агент работает',
        context_size: 'Размер контекста',
        max_iterations: 'Максимум итераций',
        context_size_hint:
            'Сколько токенов агент может потратить на один вызов модели. Больше контекст, точнее ответ и дороже запрос',
        max_iterations_hint:
            'Сколько шагов агент сделает, прежде чем остановиться. Больше шагов, сложнее задачи и дороже запрос',
        editing_locked: 'Пока агент работает, проект менять нельзя',
        leave_confirm: 'Агент ещё работает. Точно уйти со страницы?',
        event: {
            model_call: 'Обращение к модели',
            add_segment: 'Добавлен сегмент №{segment}',
            add_lines_to_segment: 'Изменён сегмент №{segment}',
            delete_lines_from_segment: 'Удалены строки из сегмента №{segment}',
            add_file: 'Добавлен файл',
            add_lines_to_file: 'Изменён файл',
            delete_lines_from_file: 'Удалены строки из файла',
            add_segment_plain: 'Добавлен сегмент',
            add_lines_to_segment_plain: 'Изменён сегмент',
            delete_lines_from_segment_plain: 'Удалены строки из сегмента',
            add_file_plain: 'Добавлен файл',
            add_lines_to_file_plain: 'Изменён файл',
            delete_lines_from_file_plain: 'Удалены строки из файла',
            list_workspace: 'Просмотр структуры проекта',
            read_segment: 'Чтение сегмента',
            read_segments: 'Чтение сегментов',
            search_segments: 'Поиск по сегментам',
            read_file: 'Чтение файла',
            done: 'Завершение работы',
        },
        stop: {
            ContextOverflow:
                'Задача не поместилась в контекст. Уменьшите объём запроса или увеличьте размер контекста',
            IterationLimit:
                'Агент не уложился в отведённые шаги. Изменения, которые он успел сделать, уже в проекте. Попробуйте увеличить максимум итераций или разбить задачу',
            Timeout:
                'Агента остановил сервер по времени, но итог он написать успел. Изменения уже в проекте',
            UnauthorizedLimitExceeded:
                'Лимит без регистрации исчерпан. Войдите, чтобы продолжить',
            PaymentRequired:
                'Закончились токены. Пополните баланс, чтобы продолжить',
            Locked: 'Агент уже запущен в другой вкладке или проект сейчас меняется. Дождитесь окончания и повторите',
            UnknownError: 'Что-то пошло не так. Попробуйте ещё раз',
            timeout: 'Агент не уложился в десять минут. Попробуйте ещё раз',
            disconnected: 'Связь с агентом потеряна. Попробуйте ещё раз',
            connect_failed:
                'Не удалось соединиться с агентом. Проверьте сеть и попробуйте ещё раз',
            save_failed:
                'Не удалось сохранить проект перед запуском. Агент работал бы со старой версией, поэтому запуск отменён',
        },
    },
    mobile_view: {
        files: 'Файлы',
        editor: 'Редактор',
        pdf: 'PDF',
        chat: 'Агент',
    },
    tokens_page: {
        title: 'Пополните баланс токенов',
        subtitle:
            'Токены используются для вычислений, генерации с помощью ИИ и других ресурсоемких возможностей Labkeeper.',
        balance_title: 'Ваш баланс:',
        balance_caption: 'Доступно токенов',
        unauth_balance_caption:
            'Войдите в аккаунт, чтобы увидеть баланс и купить токены.',
        buy_title: 'Выберите пакет',
        buy_subtitle:
            'Покупка пока подготовлена как моковый сценарий: оплату подключим отдельно.',
        buy_section_headline_lead: 'Единый баланс',
        buy_section_headline_rest: 'для всех\nваших задач',
        buy_section_intro:
            'В Labkeeper действует прозрачная система токенов. Это универсальная внутренняя валюта, которая позволяет вам гибко распределять ресурсы платформы под текущие нужды проекта — будь то генерация контента с помощью ИИ или сложные серверные вычисления. Вы платите только за то, что реально используете.',
        buy_packages_heading: 'Варианты пополнения:',
        authenticated_buy_balance_prefix: 'Ваш баланс:',
        package_quantity_label: 'токенов',
        package_card_subline_template: '{quantity} за {price}',
        pricing_loading: 'Загружаем актуальные цены...',
        pricing_error:
            'Не удалось загрузить актуальные цены. Попробуйте обновить страницу.',
        pricing_empty: 'Доступных тарифов сейчас нет.',
        buy_button: 'Купить',
        popular: 'Популярно',
        tokens_amount: 'токенов',
        free_benefits: {
            initial_label: 'При регистрации',
            initial_caption: 'сразу на баланс нового аккаунта',
            refill_label: 'Регулярное пополнение',
            refill_caption: 'бесплатно каждые {period}',
        },
        usage_title: 'На что\nрасходуются\nтокены',
        usage_items: [
            {
                heading: 'Работа с AI-ассистентом (GPT)',
                body: 'Попросите нейросеть написать структуру документа, перевести текст в формат Markdown или найти ошибку в коде.',
            },
            {
                heading: 'Серверная компиляция',
                body: 'Собирайте самые тяжелые PDF-документы без зависаний. Токены списываются строго за время работы мощного удалённого компилятора.',
            },
        ],
        usage_rates: {
            latex_compilation:
                'LaTeX-компиляция: {tokens} за 1 секунду работы сервера.',
            markdown_compilation:
                'Markdown-компиляция: {tokens} за 1 секунду работы сервера.',
            gpt_text_prompt: 'Текстовый GPT-запрос: {tokens} за 1 запрос.',
        },
        modal: {
            title: 'Покупка токенов',
            gateway_notice:
                'Оплата производится через безопасный платёжный шлюз ЮKassa',
            consent_offer_prefix:
                'Нажимая кнопку «Перейти к оплате», Вы принимаете ',
            consent_offer_link: 'Публичную оферту',
            consent_privacy_prefix:
                'Нажимая «Перейти к оплате», Вы даёте согласие ',
            consent_privacy_link: 'на обработку персональных данных',
            consent_privacy_policy_prefix:
                'Нажимая «Перейти к оплате», Вы соглашаетесь с ',
            consent_privacy_policy_link: 'Политикой конфиденциальности',
            pay_button: 'Перейти к оплате',
            payment_loading: 'Создаём платёж...',
            payment_error:
                'Не удалось создать платёж. Попробуйте ещё раз позже.',
            widget_error:
                'Не удалось открыть платёжную форму. Попробуйте ещё раз позже.',
        },
        navigation: {
            advantages: 'Преимущества',
            features: 'Возможности',
            for_whom: 'Для кого',
            examples: 'Примеры проектов',
            tokens: 'Токены',
            about: 'О нас',
            login: 'Войти',
            logout: 'Выйти',
            editor: 'Редактор',
            projects: 'Мои проекты',
        },
        footer: {
            copyright: `© 2024—${new Date().getFullYear()}`,
            wiki_nav: 'Wiki проекта',
            nav_aria: 'Навигация по сайту',
            contact_label: 'Написать нам',
        },
    },

    compile_error: {
        [CompileError.CODE_NO_END_QUOTES]: 'Нет закрывающих кавычек',
        [CompileError.UNKNOWN_SYMBOL]: 'Неизвестный символ',
        [CompileError.QUOTA_EXCEEDED]: 'Превышена квота',
        [CompileError.OPERATOR_EXPECTED]: 'Ожидался оператор',
        [CompileError.NUMBER_EXPECTED]: 'Ожидалось число',
        [CompileError.NAME_EXPECTED]: 'Ожидалось имя переменной',
        [CompileError.NO_SUCH_VARIABLE]: 'Несуществующая переменная',
        [CompileError.STRING_ARGUMENT_EXPECTED]:
            'Ожидался аргумент в виде строки',
        [CompileError.ARRAY_ARGUMENT_EXPECTED]:
            'Ожидался аргумент в виде массива',
        [CompileError.NO_SUCH_FUNCTION]: 'Не существует функция',
        [CompileError.ARITHMETIC_ERROR]: 'Ошибка деления на ноль',
        [CompileError.CANCELED]: 'Вычисления отменены',
        [CompileError.NOT_ENOUGH_WORKERS]:
            'На серверах не хватает вычислительной мощности для компиляции',
        [CompileError.INCORRECT_ARGUMENT_SIZE]:
            'Неправильное количество аргументов в функции',
        [CompileError.VARIABLE_INSERT_ERROR]:
            'Ошибка подстановки переменной в md текст',
        [CompileError.INCORRECT_ARGUMENTS_COUNT]:
            'Неверное количество аргументов в функции',
        [CompileError.FILE_USAGE_NOT_ALLOWED]:
            'Для использования файлов нужно аутентифицироваться',
        [CompileError.TOO_MUCH_FILES]: 'Слишком много файлов на один проект',
        [CompileError.INCORRECT_ARGUMENT]: 'Некорректный аргумент в функции',
        [CompileError.FUNCTION_HAS_NO_RETURN_VALUE]:
            'Отсутствует возвращаемое значение в функции',
        [CompileError.MULTIPLE_ERROR]: 'Множественные ошибки',
        [CompileError.LOGIN_REQUIRED]:
            'Необходимо авторизироваться, чтобы продолжить',
        [CompileError.NAME_RESERVED]:
            'E и PI нельзя использовать в названии переменной',
        [CompileError.INCORRECT_INFL_DEFINITION_ARRAY_SIZE]:
            'Погрешность нельзя задавать массивом',
        [CompileError.INCORRECT_INFL_DEFINITION_VALUE_WITH_INFL]:
            'Погрешность не должна задаваться значением, у которого уже есть погрешность',
        [CompileError.ARRAY_HAVE_ONLY_ZERO_VALUES]:
            'Массив не может содержать только нули. Возможно, стоит проверить погрешность и режим округления.',
        [CompileError.LATEX_ERROR]: 'Ошибка компиляции latex',
    },
    error_common: {
        segment: 'Сегмент',
        file: 'Файл',
        common_errors: 'Общие ошибки',
        line: 'строка',
        operator_expected: 'Ожидался оператор',
        now: 'Сейчас',
        max: 'Максимум',
        new_line: 'Новая линия',
        variable: 'Переменная',
    },
    authorization: {
        title: 'Авторизация',
        loginVia: 'Войти через',
        loginAndPasswoord: 'Логин и пароль',
        login: 'Войти',
        loginInput: 'Логин',
        password: 'Пароль',
        registration: 'Регистрация',
        forgotPassword: 'Забыли пароль?',
        sendCode: 'Отправить код',
        confirmCode: 'Подтвердить код',
        resendCode: 'Отправить код повторно',
        save: 'Сохранить',
        confirmPassword: 'Подтвердите пароль',
        alreadyHaveAccount: 'Уже есть аккаунт?',
        createAccount: 'Создать аккаунт',
        continue: 'Продолжить',
        closeConfirmation: {
            title: 'Прервать процесс?',
            description:
                'Введённые данные будут потеряны, а процесс регистрации или восстановления пароля прервётся.',
            interrupt: 'Прервать',
            continue: 'Продолжить',
        },
        personalDataAgreement:
            'Я даю согласие на обработку моих персональных данных в соответствии с',
        personalDataPolicyLink: 'Политикой обработки персональных данных',
        personalDataAgreementAnd: 'и',
        personalDataConsentLink: 'согласием на обработку персональных данных',
        views: {
            email: 'Введите email',
            code: 'Введите код',
            password: 'Установите пароль',
            success: 'Успешно',
            emailSubtitle: 'Мы отправим код подтверждения на ваш email',
            codeSubtitle: 'Введите код, который мы отправили на ваш email',
            passwordSubtitle: 'Придумайте надежный пароль для вашего аккаунта',
            successSubtitle: 'Пароль успешно установлен',
        },
        errors: {
            userExists: 'Пользователь с таким email уже существует',
            userNotFound: 'Пользователь не найден',
            invalidEmail: 'Неверный формат email',
            invalidCode: 'Неверный код',
            invalidPassword: 'Пароль должен содержать минимум 8 символов',
            passwordsDontMatch: 'Пароли не совпадают',
            fillAllFields: 'Пожалуйста, заполните все поля',
            passwordSetError: 'Ошибка установки пароля',
            credentialsError: 'Неправильный логин или пароль',
            oauthError: 'Ошибка входа через сторонний провайдер',
            unknownError: 'Неизвестная ошибка',
        },
    },
    loginModal: {
        submit: 'Войти',
        loginToProceed: 'Войдите, чтобы продолжить',
        description: 'Вы вышли из системы, поскольку срок вашей сессии истек.',
    },
    quota_definition: {
        '1': 'Cлишком много сегментов',
        '2': 'Cлишком много операторов экспоненты',
        '3': 'Cлишком много символов',
        '4': 'Cлишком много функций',
        '5': 'Cлишком большие константы',
        '6': 'Превышено время выполнения программы',
    },

    filemanager: {
        title: 'Файлы',
        add: 'Добавить файл',
        dropzoneTitle: 'Переместите файл сюда',
        root_folder: 'Ваши файлы',
        drop_to_root: 'Переместить в ваши файлы',
        drop_to_folder: 'Переместить в папку ${path}',
        upload_target: 'Загрузка в: ${path}',
        delete: 'Удалить',
        edit: 'Редактировать',
        your_files: 'Ваши файлы',
        system_files: 'Системные файлы',
        create_folder: 'Новая папка',
        create_file: 'Создать файл',
        empty: 'Файлов пока нет',
        errors: {
            tooMuchFiles: 'Слишком много файлов для одного проекта.',
            sessionExpired: 'Сессия истекла',
            internalError:
                'Внутренняя ошибка.\nМы обязательно исправим ее в ближайшее время!',
            tooBigFile: 'Файл слишком большой. Максимум ${replace1} Мб',
            notSupported: 'Формат файла не поддерживается',
            notEnoughRights: 'Не хватает прав для просмотра проекта',
            notFound: 'Такого проекта не существует',
            noNetwork: 'Отсутствует соединение с сервером',
            bad_name:
                'Название содержит недопустимые символы или слишком длинное',
            fileAlreadyExists: 'Файл с таким именем уже существует',
            rename_file_failed:
                'Не удалось переименовать файл. Попробуйте ещё раз',
            rename_folder_failed:
                'Не удалось переименовать папку. Попробуйте ещё раз',
            upload_failed: 'Не удалось загрузить файл. Попробуйте ещё раз',
        },
    },
    share_modal: {
        title: 'Поделиться',
        private_access: 'Доступ только для меня',
        public_access: 'Доступ для всех',
        copy_link: 'Копировать ссылку для шаринга',
        link_copied: 'Ссылка скопирована в буфер обмена',
        copy_error: 'Не удалось скопировать ссылку',
    },
    delete_files_modal: {
        title: 'Вы удалили все ссылки на файлы из вашего кода. Хотите удалить следующие файлы из проекта?',
    },
    privacy_policy_acceptance_modal: {
        title: 'Политика конфиденциальности',
        description_prefix:
            'Для продолжения работы с сайтом Labkeeper ознакомьтесь с ',
        privacy_policy: 'политикой конфиденциальности',
        description_middle: ' и примите ',
        personal_data_consent: 'согласие на обработку персональных данных',
        description_suffix: '.',
        accept: 'Принять',
        error: 'Не удалось сохранить принятие политики. Попробуйте ещё раз',
    },
    wiki: 'wiki',
    readonly_public_project: 'Публичный проект, доступный только для чтения',
    clone: 'Клонировать',
    contact_modal: {
        button: 'Связаться с нами',
        title: 'Связаться с нами',
        subject: 'Тема',
        subject_placeholder: 'Кратко опишите тему',
        message: 'Сообщение',
        message_placeholder: 'Опишите ваш вопрос или предложение',
        send: 'Отправить',
        cancel: 'Отмена',
        warn: 'Заполните тему и сообщение',
        err: 'Не удалось открыть почтовый клиент',
        contact_form: 'Связаться с нами через форму',
        contact_email: 'Напишите нам на почту',
        agreement_prefix: 'Связываясь с нами, вы подтверждаете',
        privacy_policy: 'политику конфиденциальности',
        agreement_and: 'и',
        personal_data_consent: 'согласие на обработку персональных данных',
    },

    prompt_modal: {
        errors: {
            payment_required: 'Вам необходимо пополнить баланс токенов.',
        },
    },

    hunks: {
        accept: 'Принять',
        revert: 'Отклонить',
        accept_add: 'Принять и добавить',
        accept_all: 'Принять все',
        revert_all: 'Отклонить все',
        total_changes: 'Всего {n} изменений',
        new: 'new',
        collapse_bar: 'Свернуть плашку изменений',
        expand_bar: 'Развернуть плашку изменений',
    },

    contact_ok: 'Мы получили вашу обратную связь',
    contact_error: 'Произошла непредвиденная ошибка',
};
