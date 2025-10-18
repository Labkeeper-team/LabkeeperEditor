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
    label_add_markdown: 'Добавить маркдаун',
    label_add_markdown_short: 'MD',
    label_save_to_pdf: 'Сохранить в PDF',
    label_problems: 'Проблемы',
    label_add_code: 'Вычисление',
    label_add_latex: 'Latex-формула',
    label_add_more: 'Добавить еще',
    label_add_more_short: 'Еще',

    short_segment: {
        md: 'Макрдаун',
        computational: 'Вычисление',
        latex: 'Latex-формула',
        asciimath: 'Простая формула',
    },

    segment_divider: {
        add: 'Добавить',
        computation: 'Вычисления',
        markdown: 'Маркдаун',
        latex: 'Latex-формула',
        asciimath: 'Простая формула',
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
        latex: 'latex-формула',
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
        mode: {
            markdown: 'markdown',
            latex: 'latex',
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
        [CompileError.ARITHMETIC_ERROR]: 'Арифметическая ошибка',
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
    },
    error_common: {
        segment: 'Сегмент',
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
        delete: 'Удалить',
        edit: 'Редактировать',
        your_files: 'Ваши файлы',
        system_files: 'Системные файлы',
        errors: {
            tooMuchFiles: 'Слишком много файлов для одного проекта.',
            sessionExpired: 'Сессия истекла',
            internalError:
                'Внутренняя ошибка.\nМы обязательно исправим ее в ближайшее время!',
            tooBigFile: 'Файл слишком большой.Максимум ${replace1} Мб',
            notSupported: 'Формат файла не поддерживается',
            notEnoughRights: 'Не хватает прав для просмотра проекта',
            notFound: 'Такого проекта не существует',
            noNetwork: 'Отсутствует соединение с сервером',
            bad_name: 'Не используйте слэши в названии файла',
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
    },

    contact_ok: 'Мы получили вашу обратную связь',
    contact_error: 'Произошла непредвиденная ошибка',
};
