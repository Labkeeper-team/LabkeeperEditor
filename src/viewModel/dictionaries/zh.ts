import { Translations } from './index.ts';
import { CompileError } from '../../model/domain.ts';
export const zh: Translations = {
    or: '\u6216',
    login: '\u767B\u5F55',
    exit: '\u9000\u51FA',
    delete: '\u5220\u9664',
    run: '\u8FD0\u884C',
    loading: '\u52A0\u8F7D\u4E2D',
    yes: '\u662F',
    no: '\u5426',
    add_segment: '\u6DFB\u52A0\u4EE3\u7801\u4EE5\u8FD0\u884C\u7A0B\u5E8F',
    no_comp_segment:
        '\u8BF7\u6DFB\u52A0\u8BA1\u7B97\u7247\u6BB5\u540E\u518D\u8FD0\u884C',

    warning_dontuselongvarioables:
        '\u8BF7\u52FF\u4F7F\u7528\u8FC7\u957F\u7684\u53D8\u91CF\u540D',

    label_add_asciimath: '\u7B80\u6613\u516C\u5F0F',
    label_add_markdown: 'Markdown',
    label_add_markdown_short: 'MD',
    label_add_code: '\u8BA1\u7B97',
    label_add_latex: 'Latex',
    label_add_more: '\u6DFB\u52A0',
    label_add_more_short: '\u66F4\u591A',
    label_save_to_pdf: '\u4FDD\u5B58\u4E3A PDF',
    label_problems: '\u95EE\u9898',

    short_segment: {
        md: 'Markdown',
        computational: '\u8BA1\u7B97',
        latex: 'Latex',
        asciimath: '\u7B80\u6613\u516C\u5F0F',
        mermaid: 'Mermaid',
        plantuml: 'PlantUML',
        drawio: 'draw.io',
    },

    diagram: {
        loading: '\u6B63\u5728\u7ED8\u5236\u56FE\u8868',
        failed: '\u65E0\u6CD5\u7ED8\u5236\u56FE\u8868',
        bad_drawio_xml:
            '\u8FD9\u4E0D\u662F draw.io \u56FE\u8868 XML\uFF1A\u5E94\u5305\u542B mxfile \u6216 mxGraphModel',
    },

    segment_error: {
        message:
            '\u65E0\u6CD5\u663E\u793A\u6B64\u7247\u6BB5\uFF0C\u5176\u6587\u672C\u5185\u5BB9\u672A\u53D7\u5F71\u54CD',
        retry: '\u91CD\u65B0\u663E\u793A',
    },

    segment_divider: {
        add: '\u6DFB\u52A0',
        computation: '\u8BA1\u7B97',
        markdown: 'Markdown',
        latex: 'Latex',
        asciimath: '\u7B80\u6613\u516C\u5F0F',
        mermaid: 'Mermaid',
        plantuml: 'PlantUML',
        drawio: 'draw.io',
    },
    latex_boundary: {
        header: 'LaTeX \u6587\u9996',
        footer: 'LaTeX \u6587\u672B',
        insert_hint: '\u70B9\u51FB\u63D2\u5165\u53EF\u7F16\u8F91\u7247\u6BB5',
    },

    interface_tour: {
        label: '\u754C\u9762\u5BFC\u89C8',
        info_history_button:
            '\u5386\u53F2\u6309\u94AE\u7528\u4E8E\u5207\u6362\u5230\u4EE3\u7801\u7684\u65E9\u671F\u7248\u672C',
        info_computed_segment:
            '\u6DFB\u52A0\u5305\u542B\u8BA1\u7B97\u3001Markdown \u6587\u672C\u3001\u516C\u5F0F\u548C\u56FE\u8868\u7684\u7247\u6BB5\u3002',
        info_project_settings:
            '\u4ECE\u53EF\u7528\u9009\u9879\u4E2D\u9009\u62E9\uFF0C\u914D\u7F6E\u4F60\u7684\u9879\u76EE',
        info_run:
            '\u6784\u5EFA\u6587\u6863\u6216\u8FD0\u884C\u8BA1\u7B97\uFF0C\u7ED3\u679C\u5C06\u663E\u793A\u5728\u9884\u89C8\u9762\u677F\u4E2D\u3002',
        info_result:
            '\u67E5\u770B\u5B8C\u6210\u7684\u6587\u6863\uFF1APDF\uFF0C\u6216\u6E32\u67D3\u540E\u7684\u6587\u672C\u3001\u516C\u5F0F\u3001\u56FE\u5F62\u548C\u56FE\u8868\u3002',
        info_pdf:
            '\u5982\u9700\u4FDD\u5B58\u6216\u6253\u5370\u8BA1\u7B97\u7ED3\u679C\uFF0C\u53EF\u5C06\u5176\u8F6C\u6362\u4E3A PDF\u3002',
        info_error:
            '\u7F16\u8BD1\u65F6\u5728\u4EE3\u7801\u4E2D\u53D1\u73B0\u7684\u9519\u8BEF\u5217\u8868\u3002',
        info_add_markdown:
            '\u4F60\u53EF\u4EE5\u6DFB\u52A0 Markdown \u6587\u672C\u7247\u6BB5\u3002\n\u4E5F\u53EF\u4EE5\u4F7F\u7528 ${NAME} \u63D2\u5165\u53D8\u91CF\u503C\u3002',
        info_canvas:
            '\u8FD9\u91CC\u662F\u6784\u6210\u7A0B\u5E8F\u7684\u5404\u4E2A\u7247\u6BB5\u3002',
        info_mobile_navigation:
            '\u901A\u8FC7\u6B64\u83DC\u5355\u5728\u9879\u76EE\u7684\u5404\u4E2A\u533A\u57DF\u4E4B\u95F4\u5207\u6362\uFF0C\u53EF\u7528\u9009\u9879\u53D6\u51B3\u4E8E\u9879\u76EE\u6A21\u5F0F\u3002',
        info_agent_prompt:
            '\u63CF\u8FF0\u4EFB\u52A1\u6216\u5411\u667A\u80FD\u4F53\u63D0\u95EE',
        info_agent_files:
            '\u4E0A\u4F20\u9879\u76EE\u6587\u4EF6\u4F9B\u667A\u80FD\u4F53\u4F7F\u7528\u3002\u767B\u5F55\u540E\u5373\u53EF\u4E0A\u4F20\u6587\u4EF6\u3002',
        info_agent_settings:
            '\u6839\u636E\u4F60\u7684\u4EFB\u52A1\u8C03\u6574\u667A\u80FD\u4F53\u8BBE\u7F6E\u3002',
        info_enter_agent_mode:
            '\u6253\u5F00\u667A\u80FD\u4F53\u6A21\u5F0F\uFF0C\u501F\u52A9 AI \u521B\u5EFA\u6587\u6863\uFF1A\u63CF\u8FF0\u4F60\u7684\u9700\u6C42\uFF0C\u667A\u80FD\u4F53\u4F1A\u51C6\u5907\u597D\u6587\u672C\u548C\u6392\u7248\u3002',
        info_leave_agent_mode:
            '\u8FD4\u56DE\u5305\u542B\u4EE3\u7801\u7F16\u8F91\u5668\u3001\u9879\u76EE\u6587\u4EF6\u548C\u9884\u89C8\u7684\u5B8C\u6574\u5E03\u5C40\u3002',
    },
    label_no_result_part1: '\u6DFB\u52A0\u4EE3\u7801\u6216 Markdown',
    label_no_result_part2: '\u7136\u540E\u70B9\u51FB\u201C\u8FD0\u884C\u201D', //Add the code or markdown and click "RUN"
    delete_modal: '\u786E\u5B9A\u8981\u5220\u9664\u5417',
    new_project: {
        title: '\u65B0\u5EFA\u9879\u76EE',
        back: '\u6211\u7684\u9879\u76EE',
        name: '\u9879\u76EE\u540D\u79F0',
        project_type: '\u9879\u76EE\u7C7B\u578B',
        type_latex: 'LaTeX',
        type_latex_hint:
            '\u7247\u6BB5\u4F1A\u7EC4\u88C5\u4E3A LaTeX\uFF0C\u7531\u670D\u52A1\u5668\u7F16\u8BD1\u6210 PDF\u3002\u652F\u6301\u5168\u90E8 LaTeX \u529F\u80FD\uFF0C\u4F46\u6784\u5EFA\u7A0D\u6162',
        type_markdown: 'Markdown',
        type_markdown_hint:
            '\u7247\u6BB5\u4F1A\u8F6C\u6362\u4E3A Markdown \u5E76\u76F4\u63A5\u5728\u6D4F\u89C8\u5668\u4E2D\u6E32\u67D3\u3002\u901F\u5EA6\u5FEB\uFF0C\u4F46\u590D\u6742\u7684 LaTeX \u6548\u679C\u4F1A\u6709\u6240\u7B80\u5316',
        type_from_template:
            '\u7C7B\u578B\u7531\u6A21\u677F\u51B3\u5B9A\u3002\u5982\u9700\u81EA\u884C\u9009\u62E9\uFF0C\u8BF7\u9009\u62E9\u7A7A\u9879\u76EE',
        type_from_archive:
            '\u7C7B\u578B\u7531\u538B\u7F29\u5305\u51B3\u5B9A\u3002\u5982\u9700\u81EA\u884C\u9009\u62E9\uFF0C\u8BF7\u9009\u62E9\u7A7A\u9879\u76EE',
        template: '\u8D77\u59CB\u5185\u5BB9',
        empty_project: '\u7A7A\u9879\u76EE',
        empty_project_hint:
            '\u6240\u9009\u7C7B\u578B\u7684\u7A7A\u767D\u9875\u9762',
        archive: '\u4ECE\u538B\u7F29\u5305\u521B\u5EFA\u9879\u76EE',
        archive_hint:
            'Labkeeper \u5BFC\u51FA\u7684 zip \u6587\u4EF6\u6216\u5305\u542B main.tex \u7684\u538B\u7F29\u5305',
        archive_choose: '\u4E0A\u4F20\u538B\u7F29\u5305',
        archive_replace: '\u66F4\u6362\u538B\u7F29\u5305',
        archive_remove: '\u79FB\u9664',
        all_templates: '\u5168\u90E8\u6A21\u677F',
        categories: {
            labs: '\u5B9E\u9A8C\u62A5\u544A',
            diploma: '\u6BD5\u4E1A\u8BBA\u6587',
            cv: '\u7B80\u5386 / CV',
        },
        templates_loading: '\u6B63\u5728\u52A0\u8F7D\u6A21\u677F\u2026',
        templates_error: '\u65E0\u6CD5\u52A0\u8F7D\u6A21\u677F',
        templates_retry: '\u91CD\u8BD5',
        template_page: '\u5173\u4E8E\u6B64\u6A21\u677F',
        agent_mode: '\u5728\u667A\u80FD\u4F53\u6A21\u5F0F\u4E2D\u6253\u5F00',
        agent_mode_hint:
            '\u63CF\u8FF0\u6587\u6863\uFF0C\u667A\u80FD\u4F53\u5C06\u4E3A\u4F60\u751F\u6210',
        create: '\u521B\u5EFA\u9879\u76EE',
        creating: '\u6B63\u5728\u521B\u5EFA\u2026',
        error: {
            empty_name: '\u8BF7\u8F93\u5165\u9879\u76EE\u540D\u79F0',
            too_many_projects: '\u9879\u76EE\u6570\u91CF\u8FC7\u591A',
            template_unavailable:
                '\u6B64\u6A21\u677F\u6682\u4E0D\u53EF\u7528\uFF0C\u8BF7\u9009\u62E9\u5176\u4ED6\u6A21\u677F',
            archive_invalid:
                '\u8FD9\u4E0D\u662F\u9879\u76EE\u538B\u7F29\u5305\uFF1A\u8BF7\u4F7F\u7528 Labkeeper \u5BFC\u51FA\u7684 zip \u6587\u4EF6\u6216\u5305\u542B main.tex \u7684\u538B\u7F29\u5305',
            archive_too_many_files:
                '\u538B\u7F29\u5305\u4E2D\u7684\u6587\u4EF6\u8FC7\u591A',
            archive_too_big:
                '\u538B\u7F29\u5305\u6216\u5176\u4E2D\u7684\u6587\u4EF6\u8FC7\u5927',
            failed: '\u65E0\u6CD5\u521B\u5EFA\u9879\u76EE\uFF0C\u8BF7\u91CD\u8BD5',
        },
    },
    rounding_mode: {
        label: '\u820D\u5165\u6A21\u5F0F',
        without_round: '\u4E0D\u820D\u5165',
        first_digit:
            '\u8BEF\u5DEE\u7684\u7B2C\u4E00\u4F4D\u6709\u6548\u6570\u5B57',
        five_digits: '\u4E94\u4F4D\u6570\u5B57',
        one_digit: '\u4E00\u4F4D\u6570\u5B57',
        two_digits: '\u4E24\u4F4D\u6570\u5B57',
        three_digits: '\u4E09\u4F4D\u6570\u5B57',
    },
    label_syntax_highlight: '\u8BED\u6CD5\u9AD8\u4EAE',
    label_autocompilation: '\u81EA\u52A8\u7F16\u8BD1',

    placeholder_search: '\u8F93\u5165\u8981\u641C\u7D22\u7684\u6587\u672C',
    projects: {
        label: '\u9879\u76EE',
        title: '\u540D\u79F0',
        last_modified: '\u4FEE\u6539\u65F6\u95F4',
        add: '\u6DFB\u52A0',
        search_placeholder: '\u6309\u540D\u79F0\u6216\u6807\u7B7E\u641C\u7D22',
        created: '\u521B\u5EFA\u65F6\u95F4',
        sort_az: '\u4ECE A \u5230 Z',
        sort_za: '\u4ECE Z \u5230 A',
        type: '\u7C7B\u578B',
        access: '\u8BBF\u95EE\u6743\u9650',
        public: '\u516C\u5F00',
        private: '\u79C1\u6709',
        all: '\u5168\u90E8',
        tags: '\u6807\u7B7E',
        no_tags: '\u65E0\u6807\u7B7E',
        shown: '${shown} / ${total}',
        no_matches:
            '\u6CA1\u6709\u7B26\u5408\u7B5B\u9009\u6761\u4EF6\u7684\u9879\u76EE',
        reset_filters: '\u91CD\u7F6E\u7B5B\u9009',
        empty_title: '\u8FD8\u6CA1\u6709\u9879\u76EE',
        empty_text:
            '\u4ECE\u7A7A\u767D\u3001\u6A21\u677F\u6216\u538B\u7F29\u5305\u521B\u5EFA\u9879\u76EE',
        link_copied: '\u94FE\u63A5\u5DF2\u590D\u5236',
        duplicated: '\u5DF2\u521B\u5EFA\u9879\u76EE\u526F\u672C',
        actions: {
            menu: '\u9879\u76EE\u64CD\u4F5C',
            open: '\u6253\u5F00',
            open_new_tab: '\u5728\u65B0\u6807\u7B7E\u9875\u4E2D\u6253\u5F00',
            rename: '\u91CD\u547D\u540D',
            edit_tags: '\u6807\u7B7E\u2026',
            duplicate: '\u521B\u5EFA\u526F\u672C',
            make_public: '\u8BBE\u4E3A\u516C\u5F00',
            make_private: '\u8BBE\u4E3A\u79C1\u6709',
            copy_link: '\u590D\u5236\u94FE\u63A5',
            download: '\u4E0B\u8F7D\u538B\u7F29\u5305',
            delete: '\u5220\u9664',
        },
        sidebar: {
            all_projects: '\u5168\u90E8\u9879\u76EE',
            public_projects: '\u516C\u5F00',
            private_projects: '\u79C1\u6709',
            new_tag: '\u65B0\u5EFA\u6807\u7B7E',
            edit_tag: '\u7F16\u8F91\u6807\u7B7E',
            tag_menu: '\u6807\u7B7E\u64CD\u4F5C',
            edit: '\u7F16\u8F91',
            tag_name: '\u540D\u79F0',
            tag_color: '\u989C\u8272',
            tag_projects: '\u9879\u76EE',
            tag_projects_hint:
                '\u6807\u7B7E\u4FDD\u5B58\u5728\u9879\u76EE\u4E2D\uFF0C\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u9879\u76EE',
            tag_exists: '\u5DF2\u5B58\u5728\u540C\u540D\u6807\u7B7E',
            delete_tag_confirm:
                '\u4ECE\u6240\u6709\u9879\u76EE\u4E2D\u79FB\u9664\u6807\u7B7E\u201C${name}\u201D\uFF1F\u9879\u76EE\u672C\u8EAB\u4F1A\u4FDD\u7559\u3002',
        },
        tags_modal: {
            title: '\u9879\u76EE\u6807\u7B7E',
            add_placeholder: '\u65B0\u6807\u7B7E',
            add: '\u6DFB\u52A0',
            empty: '\u8BE5\u9879\u76EE\u8FD8\u6CA1\u6709\u6807\u7B7E',
            suggestions: '\u60A8\u7684\u6807\u7B7E',
            save: '\u4FDD\u5B58',
            cancel: '\u53D6\u6D88',
            duplicate: '\u8BE5\u9879\u76EE\u5DF2\u6709\u6B64\u6807\u7B7E',
            limit: '\u4E00\u4E2A\u9879\u76EE\u6700\u591A\u53EA\u80FD\u6709 ${max} \u4E2A\u6807\u7B7E',
        },
        errors: {
            empty_name:
                '\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u4E5F\u4E0D\u80FD\u4EC5\u5305\u542B\u7A7A\u683C\u3002',
            sessionExpiredReload:
                '\u4F1A\u8BDD\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u5237\u65B0\u9875\u9762',
            tags_failed: '\u65E0\u6CD5\u4FDD\u5B58\u6807\u7B7E',
            visibility_failed:
                '\u65E0\u6CD5\u66F4\u6539\u8BBF\u95EE\u6743\u9650',
            duplicate_failed: '\u65E0\u6CD5\u590D\u5236\u9879\u76EE',
            download_failed: '\u65E0\u6CD5\u4E0B\u8F7D\u538B\u7F29\u5305',
            rename_failed: '\u65E0\u6CD5\u91CD\u547D\u540D\u9879\u76EE',
            delete_failed: '\u65E0\u6CD5\u5220\u9664\u9879\u76EE',
            copy_link_failed: '\u65E0\u6CD5\u590D\u5236\u94FE\u63A5',
            project_busy:
                '\u9879\u76EE\u6B63\u5FD9\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5',
        },
    },
    segment: {
        code: '\u4EE3\u7801',
        markdown: 'markdown',
        visible: '\u53EF\u89C1',
        hide_assignment_with_values:
            '\u9690\u85CF\u4EE3\u5165\u6570\u503C\u540E\u7684\u516C\u5F0F',
        hide_array: '\u9690\u85CF\u6570\u7EC4',
        hide_general_formula:
            '\u9690\u85CF\u504F\u5FAE\u5206\u8BEF\u5DEE\u7684\u901A\u7528\u516C\u5F0F',
        hide_infl_assignment: '\u9690\u85CF\u8BEF\u5DEE\u516C\u5F0F',
        hide_infl_assignment_with_values:
            '\u9690\u85CF\u4EE3\u5165\u6570\u503C\u540E\u7684\u8BEF\u5DEE\u516C\u5F0F',
        errors: {
            non_authorized_paste_image:
                '\u767B\u5F55\u540E\u624D\u80FD\u7C98\u8D34\u56FE\u7247',
            paste_file_not_supported:
                '\u65E0\u6CD5\u5C06\u6587\u4EF6\u7C98\u8D34\u5230 ${replace1} \u7247\u6BB5\u4E2D\u3002\u56FE\u7247\u548C\u6587\u4EF6\u53EF\u7C98\u8D34\u5230 Markdown\u3001Latex \u548C\u8BA1\u7B97\u7247\u6BB5\u4E2D',
            paste_file_unsupported:
                '\u6587\u4EF6 ${file} \u65E0\u6CD5\u7C98\u8D34\u5230 ${segment} \u7247\u6BB5\u4E2D\uFF1A\u8BE5\u7247\u6BB5\u4EC5\u63A5\u53D7${allowed}\u3002\u5176\u4ED6\u6587\u4EF6\u8BF7\u5728\u6587\u4EF6\u7BA1\u7406\u5668\u4E2D\u6DFB\u52A0',
            paste_file_kinds: {
                image: '\u56FE\u7247',
                csv: '.csv \u8868\u683C',
                tex: '.tex \u6587\u4EF6',
                and: '\u548C',
            },
            paste_tex_markdown_project:
                '.tex \u6587\u4EF6\u4EC5\u5728 LaTeX \u9879\u76EE\u4E2D\u751F\u6548\u3002\u8BF7\u5728\u7247\u6BB5\u4E0A\u65B9\u7684\u8BBE\u7F6E\u4E2D\u66F4\u6539\u9879\u76EE\u7C7B\u578B',
        },
        latex: 'latex',
        asciimath: '\u7B80\u6613\u516C\u5F0F',
        no_computation_result: '\u6682\u65E0\u8BA1\u7B97\u7ED3\u679C',
        run_to_view:
            '\u70B9\u51FB\u8FD0\u884C\u6309\u94AE\u67E5\u770B\u8BA1\u7B97\u7ED3\u679C',
        hide_assignment:
            '\u9690\u85CF\u7528\u4E8E\u8BA1\u7B97\u7684\u4E3B\u516C\u5F0F',
        hide_value: '\u9690\u85CF\u6700\u7EC8\u6570\u503C\u7ED3\u679C',
        hide_infl: '\u9690\u85CF\u6700\u7EC8\u8BEF\u5DEE\u7ED3\u679C',
    },

    instructions: {
        adding_segment: '\u6DFB\u52A0\u7247\u6BB5',
        label: '\u4F7F\u7528\u8BF4\u660E',
    },

    viewer: {
        no_pdf: '\u70B9\u51FB\u201C\u8FD0\u884C\u201D\u6309\u94AE\u4EE5\u663E\u793A PDF \u6587\u4EF6\u3002',
        compiling: '\u6B63\u5728\u6784\u5EFA\u6587\u6863\u2026',
        pdf_loading: '\u6B63\u5728\u52A0\u8F7D PDF\u2026',
        mode: {
            label: '\u9879\u76EE\u7C7B\u578B',
            markdown: 'markdown',
            latex: 'latex',
        },
    },
    synctex: {
        to_pdf: '\u8DF3\u8F6C\u5230 PDF',
        to_editor: '\u8DF3\u8F6C\u5230\u6E90\u7801',
        errors: {
            no_pdf: '\u8BF7\u5148\u7F16\u8BD1\u9879\u76EE\uFF0C\u624D\u80FD\u4E0E PDF \u540C\u6B65\u3002',
            no_cursor:
                '\u8BF7\u5148\u5C06\u5149\u6807\u7F6E\u4E8E\u67D0\u4E2A\u7247\u6BB5\u6216\u6587\u4EF6\u4E2D\u3002',
            no_pdf_selection:
                '\u5728 PDF \u4E2D\u70B9\u51FB\u4EE5\u9009\u62E9\u4F4D\u7F6E\u3002',
            failed: '\u65E0\u6CD5\u540C\u6B65\u4F4D\u7F6E\uFF0C\u8BF7\u91CD\u65B0\u7F16\u8BD1\u540E\u91CD\u8BD5\u3002',
            locked: 'PDF \u6B63\u5728\u5904\u7406\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002',
            missing:
                '\u6CA1\u6709\u5DF2\u7F16\u8BD1\u7684 PDF\uFF0C\u8BF7\u7F16\u8BD1\u9879\u76EE\u540E\u91CD\u8BD5\u3002',
        },
    },
    header_menu: {
        menu: '\u83DC\u5355',
        templates: '\u6A21\u677F',
        privacy_policy: '\u9690\u79C1\u653F\u7B56',
        tokens: '\u4EE3\u5E01',
        top_up_balance: '\u5145\u503C',
        about: '\u5173\u4E8E\u6211\u4EEC',
        contact_us: '\u8054\u7CFB\u6211\u4EEC',
        my_projects: '\u6211\u7684\u9879\u76EE',
        logout: '\u9000\u51FA\u767B\u5F55',
        logout_confirmation:
            '\u786E\u5B9A\u8981\u9000\u51FA\u767B\u5F55\u5417\uFF1F',
        share: '\u5206\u4EAB',
        language: '\u8BED\u8A00',
        change_language_to: '\u5C06\u8BED\u8A00\u5207\u6362\u4E3A{language}',
        github: 'GitHub',
    },
    hotkeys: {
        open: '\u952E\u76D8\u5FEB\u6377\u952E',
        title: '\u952E\u76D8\u5FEB\u6377\u952E',
        slide_more:
            '\u66F4\u591A\u5185\u5BB9\u8BF7\u89C1\u5E2E\u52A9\u83DC\u5355\uFF1A',
        sections: {
            project: '\u9879\u76EE',
            editing: '\u7F16\u8F91',
            chat: '\u667A\u80FD\u4F53\u5BF9\u8BDD',
        },
        actions: {
            search_open: '\u5728\u7247\u6BB5\u4E2D\u641C\u7D22',
            search_step:
                '\u4E0B\u4E00\u4E2A\u548C\u4E0A\u4E00\u4E2A\u5339\u914D\u9879',
            file_manager: '\u663E\u793A\u6216\u9690\u85CF\u6587\u4EF6',
            sync_to_pdf: '\u4ECE\u4EE3\u7801\u8DF3\u8F6C\u5230 PDF',
            sync_to_editor: '\u4ECE PDF \u8DF3\u8F6C\u5230\u4EE3\u7801',
            segment_step:
                '\u4E0A\u4E00\u4E2A\u548C\u4E0B\u4E00\u4E2A\u7247\u6BB5',
            add_latex: '\u6DFB\u52A0 LaTeX \u7247\u6BB5',
            compile: '\u6784\u5EFA\u9879\u76EE',
            send_errors_to_agent:
                '\u5C06\u9519\u8BEF\u53D1\u9001\u7ED9\u667A\u80FD\u4F53',
            viewer_pdf: '\u6700\u7EC8\u6587\u6863',
            viewer_chat: '\u667A\u80FD\u4F53\u5BF9\u8BDD',
            agent_mode: '\u667A\u80FD\u4F53\u6A21\u5F0F',
            save: '\u6784\u5EFA\u9879\u76EE\uFF0C\u4FDD\u5B58\u6253\u5F00\u7684\u6587\u4EF6',
            undo: '\u64A4\u9500',
            redo: '\u91CD\u505A',
            escape: '\u5173\u95ED\u641C\u7D22\u3001\u9762\u677F\u6216\u5BF9\u8BDD\u6846',
            chat_send: '\u53D1\u9001\u8BF7\u6C42',
            chat_newline: '\u6362\u884C',
            chat_mode:
                '\u667A\u80FD\u4F53\u6A21\u5F0F\u6216\u63D0\u95EE\u6A21\u5F0F',
        },
    },
    project_export: {
        label: '\u5BFC\u51FA',
        labkeeper: 'Labkeeper \u538B\u7F29\u5305',
        labkeeper_hint:
            '\u9879\u76EE\u7684\u539F\u6837\u526F\u672C\uFF1A\u7247\u6BB5\u3001\u8BBE\u7F6E\u548C\u4F60\u7684\u6587\u4EF6',
        tex: 'LaTeX \u538B\u7F29\u5305',
        tex_hint:
            '\u5305\u542B\u7531\u6240\u6709\u7247\u6BB5\u751F\u6210\u7684 main.tex\u3001\u4F60\u7684\u6587\u4EF6\u4EE5\u53CA\u7ED3\u679C\u56FE\u7247\uFF0C\u53EF\u5728\u4EFB\u610F LaTeX \u7F16\u8F91\u5668\uFF08\u4F8B\u5982 Overleaf\uFF09\u4E2D\u6784\u5EFA\u3002\u5BFC\u51FA\u524D\u9879\u76EE\u4F1A\u50CF\u70B9\u51FB\u201C\u8FD0\u884C\u201D\u6309\u94AE\u4E00\u6837\u6267\u884C\u4E00\u6B21\uFF0C\u5E76\u6D88\u8017\u4EE3\u5E01',
        preparing: '\u6B63\u5728\u51C6\u5907\u538B\u7F29\u5305\u2026',
        program_errors:
            '\u7A0B\u5E8F\u5B58\u5728\u9519\u8BEF\uFF0C\u672A\u80FD\u751F\u6210 LaTeX \u538B\u7F29\u5305\u3002\u9519\u8BEF\u5DF2\u663E\u793A\u5728\u95EE\u9898\u5217\u8868\u4E2D',
        tex_latex_only:
            'LaTeX \u538B\u7F29\u5305\u53EA\u80FD\u4ECE LaTeX \u9879\u76EE\u751F\u6210\u3002\u8BF7\u5728\u6B64\u83DC\u5355\u4E2D\u5C06\u9879\u76EE\u7C7B\u578B\u5207\u6362\u4E3A LaTeX',
    },
    agent_mode: {
        leave: '\u6253\u5F00\u5B8C\u6574\u4EE3\u7801\u7F16\u8F91\u5668',
        enter: '\u667A\u80FD\u4F53\u6A21\u5F0F',
        enter_hint:
            '\u4EC5\u663E\u793A\u667A\u80FD\u4F53\u548C\u7F16\u8BD1\u540E\u7684 PDF\uFF0C\u4E0D\u663E\u793A\u7F16\u8F91\u5668',
        no_pdf: '\u5411\u667A\u80FD\u4F53\u63CF\u8FF0\u4F60\u60F3\u8981\u7684 PDF',
        document: '\u6700\u7EC8\u6587\u6863',
    },
    agent_chat: {
        tab_label: 'AI \u667A\u80FD\u4F53',
        pdf_tab_label: '\u6700\u7EC8\u6587\u6863',
        placeholder: '\u8F93\u5165\u4F60\u7684\u63D0\u793A\u8BCD',
        placeholder_ask:
            '\u8BE2\u95EE\u6709\u5173\u6587\u6863\u7684\u95EE\u9898\uFF0C\u667A\u80FD\u4F53\u4E0D\u4F1A\u4FEE\u6539\u6587\u6863',
        mode_agent: '\u667A\u80FD\u4F53',
        mode_ask: '\u63D0\u95EE',
        mode_agent_hint:
            '\u667A\u80FD\u4F53\u6A21\u5F0F\uFF1A\u667A\u80FD\u4F53\u4F1A\u7F16\u8F91\u6587\u6863\u3002\u70B9\u51FB\u6216\u6309 Shift+Tab \u5207\u6362\u4E3A\u4EC5\u63D0\u95EE',
        mode_ask_hint:
            '\u63D0\u95EE\u6A21\u5F0F\uFF1A\u667A\u80FD\u4F53\u53EA\u9605\u8BFB\u6587\u6863\u5E76\u56DE\u7B54\uFF0C\u4E0D\u505A\u4EFB\u4F55\u4FEE\u6539\u3002\u70B9\u51FB\u6216\u6309 Shift+Tab \u91CD\u65B0\u5141\u8BB8\u7F16\u8F91',
        resize_prompt: '\u63D0\u793A\u8BCD\u8F93\u5165\u6846\u9AD8\u5EA6',
        send: '\u53D1\u9001',
        abort: '\u505C\u6B62',
        disclaimer:
            'AI \u53EF\u80FD\u4F1A\u51FA\u9519\uFF0C\u8BF7\u4ED4\u7EC6\u68C0\u67E5\u6240\u6709\u751F\u6210\u7684\u4EE3\u7801\u3002',
        result: '\u7ED3\u679C',
        error: '\u9519\u8BEF',
        notice: '\u63D0\u793A',
        buy_tokens: '\u524D\u5F80\u8D2D\u4E70\u4EE3\u5E01',
        // общая подсказка: под отказом, который вход не снимает, обещать нечего
        guest_login_hint:
            '\u4F60\u5C1A\u672A\u767B\u5F55\u3002\u767B\u5F55\u8D26\u53F7\u540E\uFF0C\u667A\u80FD\u4F53\u5C06\u62E5\u6709\u72EC\u7ACB\u7684\u4EE3\u5E01\u4F59\u989D\u548C\u72EC\u7ACB\u7684\u5386\u53F2\u8BB0\u5F55',
        guest_login_hint_limit:
            '\u4F60\u5C1A\u672A\u767B\u5F55\uFF0C\u56E0\u6B64\u667A\u80FD\u4F53\u6309\u672A\u6CE8\u518C\u7528\u6237\u7684\u9650\u989D\u8FD0\u884C\u3002\u767B\u5F55\u540E\u53EF\u89E3\u9664\u6B64\u9650\u989D\uFF1A\u8BF7\u6C42\u8D39\u7528\u4ECE\u4F60\u7684\u4EE3\u5E01\u4F59\u989D\u4E2D\u6263\u9664\uFF0C\u5386\u53F2\u8BB0\u5F55\u548C\u4FEE\u6539\u90FD\u4F1A\u4FDD\u7559\u5728\u6587\u6863\u4E2D\u3002\u767B\u5F55\u540E\uFF0C\u8FED\u4EE3\u6B21\u6570\u3001\u4E0A\u4E0B\u6587\u5927\u5C0F\u4EE5\u53CA\u6BCF\u6B21\u8FD0\u884C\u5341\u5206\u949F\u7684\u65F6\u957F\u9650\u5236\u4ECD\u7136\u6709\u6548',
        guest_login_action: '\u767B\u5F55',
        clear_history: '\u6E05\u9664\u5386\u53F2\u8BB0\u5F55',
        clear_history_confirm:
            '\u786E\u5B9A\u8981\u6E05\u9664\u5386\u53F2\u8BB0\u5F55\u5417\uFF1F',
        clear_history_dont_ask: '\u4E0D\u518D\u8BE2\u95EE',
        history_loading: '\u6B63\u5728\u52A0\u8F7D\u5386\u53F2\u8BB0\u5F55',
        history_error: '\u65E0\u6CD5\u52A0\u8F7D\u5386\u53F2\u8BB0\u5F55',
        history_clear_error:
            '\u65E0\u6CD5\u6E05\u9664\u5386\u53F2\u8BB0\u5F55\uFF0C\u8BF7\u91CD\u8BD5',
        run_blocked: '\u667A\u80FD\u4F53\u6B63\u5728\u8FD0\u884C',
        context_size: '\u4E0A\u4E0B\u6587\u5927\u5C0F',
        max_iterations: '\u6700\u5927\u8FED\u4EE3\u6B21\u6570',
        context_size_hint:
            '\u667A\u80FD\u4F53\u5355\u6B21\u8C03\u7528\u6A21\u578B\u53EF\u4F7F\u7528\u7684\u4EE3\u5E01\u6570\u91CF\u3002\u4E0A\u4E0B\u6587\u8D8A\u5927\uFF0C\u56DE\u7B54\u8D28\u91CF\u8D8A\u597D\uFF0C\u8D39\u7528\u4E5F\u8D8A\u9AD8',
        max_iterations_hint:
            '\u667A\u80FD\u4F53\u505C\u6B62\u524D\u53EF\u6267\u884C\u7684\u6B65\u9AA4\u6570\u3002\u6B65\u9AA4\u8D8A\u591A\uFF0C\u8D8A\u80FD\u5904\u7406\u590D\u6742\u4EFB\u52A1\uFF0C\u8D39\u7528\u4E5F\u8D8A\u9AD8',
        compilation: '\u7F16\u8BD1',
        compilation_allowed: '\u5141\u8BB8\u667A\u80FD\u4F53\u7F16\u8BD1',
        compilation_allowed_hint:
            '\u667A\u80FD\u4F53\u53EF\u4EE5\u6784\u5EFA\u6587\u6863\u6765\u68C0\u67E5\u81EA\u5DF1\u7684\u4FEE\u6539\u3002\u5305\u542B\u6784\u5EFA\u7684\u8FD0\u884C\u7ED3\u675F\u540E\uFF0C\u5C06\u6253\u5F00\u7ED3\u679C',
        settings: '\u667A\u80FD\u4F53\u8BBE\u7F6E',
        settings_close: '\u5173\u95ED\u8BBE\u7F6E',
        editing_locked:
            '\u667A\u80FD\u4F53\u8FD0\u884C\u671F\u95F4\u65E0\u6CD5\u7F16\u8F91\u6587\u6863',
        leave_confirm:
            '\u667A\u80FD\u4F53\u4ECD\u5728\u8FD0\u884C\uFF0C\u4ECD\u8981\u79BB\u5F00\u6B64\u9875\u9762\u5417\uFF1F',
        send_errors: '\u53D1\u9001\u7ED9\u667A\u80FD\u4F53',
        errors_prompt: '\u4FEE\u590D\u7F16\u8BD1\u9519\u8BEF\uFF1A',
        errors_prompt_busy:
            '\u667A\u80FD\u4F53\u8F93\u5165\u6846\u4E2D\u5DF2\u6709\u6587\u672C\u3002\u8BF7\u5148\u53D1\u9001\u6216\u6E05\u7A7A\uFF0C\u7136\u540E\u518D\u6B21\u53D1\u9001\u9519\u8BEF',
        errors_agent_running:
            '\u667A\u80FD\u4F53\u4ECD\u5728\u8FD0\u884C\u3002\u8BF7\u7B49\u5F85\u5176\u5B8C\u6210\u540E\u518D\u6B21\u53D1\u9001\u9519\u8BEF',
        event: {
            model_call: '\u6B63\u5728\u8C03\u7528\u6A21\u578B',
            compile_started: '\u6B63\u5728\u6784\u5EFA\u6587\u6863',
            compile_finished: '\u6587\u6863\u5DF2\u6784\u5EFA',
            compile_failed:
                '\u6784\u5EFA\u5B8C\u6210\uFF0C\u4F46\u5B58\u5728\u9519\u8BEF',
            add_segment: '\u5DF2\u6DFB\u52A0\u65B0\u7247\u6BB5 \u2116{segment}',
            add_lines_to_segment:
                '\u5DF2\u4FEE\u6539\u7247\u6BB5 \u2116{segment}',
            delete_lines_from_segment:
                '\u5DF2\u4ECE\u7247\u6BB5 \u2116{segment} \u4E2D\u5220\u9664\u884C',
            add_file: '\u5DF2\u6DFB\u52A0\u65B0\u6587\u4EF6',
            add_lines_to_file: '\u5DF2\u4FEE\u6539\u6587\u4EF6',
            delete_lines_from_file:
                '\u5DF2\u4ECE\u6587\u4EF6\u4E2D\u5220\u9664\u884C\uFF1A',
            replace_text_in_segment:
                '\u5DF2\u66FF\u6362\u7247\u6BB5 \u2116{segment} \u4E2D\u7684\u884C',
            replace_text_in_file:
                '\u5DF2\u66FF\u6362\u6587\u4EF6\u4E2D\u7684\u884C\uFF1A',
            add_segment_plain: '\u5DF2\u6DFB\u52A0\u7247\u6BB5',
            add_lines_to_segment_plain: '\u5DF2\u4FEE\u6539\u7247\u6BB5',
            delete_lines_from_segment_plain:
                '\u5DF2\u4ECE\u7247\u6BB5\u4E2D\u5220\u9664\u884C',
            add_file_plain: '\u5DF2\u6DFB\u52A0\u6587\u4EF6',
            add_lines_to_file_plain: '\u5DF2\u4FEE\u6539\u6587\u4EF6',
            delete_lines_from_file_plain:
                '\u5DF2\u4ECE\u6587\u4EF6\u4E2D\u5220\u9664\u884C',
            replace_text_in_segment_plain:
                '\u5DF2\u66FF\u6362\u7247\u6BB5\u4E2D\u7684\u884C',
            replace_text_in_file_plain:
                '\u5DF2\u66FF\u6362\u6587\u4EF6\u4E2D\u7684\u884C',
            delete_segment: '\u5DF2\u5220\u9664\u7247\u6BB5 \u2116{segment}',
            delete_file: '\u5DF2\u5220\u9664\u6587\u4EF6',
            delete_segment_plain: '\u5DF2\u5220\u9664\u7247\u6BB5',
            delete_file_plain: '\u5DF2\u5220\u9664\u6587\u4EF6',
            list_workspace: '\u6B63\u5728\u8BFB\u53D6\u6587\u6863\u7ED3\u6784',
            read_segment: '\u6B63\u5728\u8BFB\u53D6\u7247\u6BB5',
            read_segments: '\u6B63\u5728\u8BFB\u53D6\u7247\u6BB5',
            search_segments: '\u6B63\u5728\u641C\u7D22\u7247\u6BB5',
            read_file: '\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6',
            done: '\u5373\u5C06\u5B8C\u6210',
            unknown_tool:
                '\u667A\u80FD\u4F53\u6267\u884C\u4E86\u4E00\u9879\u64CD\u4F5C',
            set_segment_parameters:
                '\u5DF2\u4FEE\u6539\u7247\u6BB5 \u2116{segment} \u7684\u53C2\u6570',
            set_segment_parameters_plain:
                '\u5DF2\u4FEE\u6539\u7247\u6BB5\u53C2\u6570',
        },
        change: {
            segment: '\u7247\u6BB5 \u2116{segment}',
            file: '\u6587\u4EF6 {file}',
            other: '\u672A\u547D\u540D\u4F4D\u7F6E',
            more: '\u4EE5\u53CA\u6587\u6863\u4E2D\u7684\u5176\u4ED6\u4F4D\u7F6E',
        },
        stop: {
            ContextOverflow:
                '\u4EFB\u52A1\u8D85\u51FA\u4E0A\u4E0B\u6587\u5BB9\u91CF\u3002\u8BF7\u7F29\u77ED\u8BF7\u6C42\u6216\u589E\u5927\u4E0A\u4E0B\u6587\u5927\u5C0F',
            IterationLimit:
                '\u667A\u80FD\u4F53\u7684\u6B65\u9AA4\u5DF2\u7528\u5B8C\uFF0C\u5DF2\u5B8C\u6210\u7684\u4FEE\u6539\u5DF2\u4FDD\u5B58\u5728\u6587\u6863\u4E2D\u3002\u8BF7\u5C1D\u8BD5\u63D0\u9AD8\u8FED\u4EE3\u6B21\u6570\u4E0A\u9650\u6216\u62C6\u5206\u4EFB\u52A1',
            Timeout:
                '\u670D\u52A1\u5668\u56E0\u8D85\u65F6\u505C\u6B62\u4E86\u667A\u80FD\u4F53\uFF0C\u4F46\u5B83\u5DF2\u5199\u5165\u7ED3\u679C\uFF0C\u4FEE\u6539\u5DF2\u4FDD\u5B58\u5728\u6587\u6863\u4E2D',
            // призыв войти приезжает отдельным блоком, в тексте ошибки он был бы вторым
            UnauthorizedLimitExceeded:
                '\u4F60\u5DF2\u8FBE\u5230\u672A\u6CE8\u518C\u7528\u6237\u7684\u4F7F\u7528\u9650\u989D',
            PaymentRequired:
                '\u4F60\u5DF2\u8FBE\u5230\u52A9\u624B\u7684\u4F7F\u7528\u9650\u989D\u3002',
            Locked: '\u667A\u80FD\u4F53\u5DF2\u5728\u53E6\u4E00\u4E2A\u6807\u7B7E\u9875\u4E2D\u8FD0\u884C\uFF0C\u6216\u6587\u6863\u6B63\u5728\u88AB\u4FEE\u6539\u3002\u8BF7\u7B49\u5F85\u5176\u5B8C\u6210\u540E\u91CD\u8BD5',
            PromptTooLong:
                '\u8BF7\u6C42\u8FC7\u957F\uFF0C\u8BF7\u7F29\u77ED\u540E\u91CD\u65B0\u53D1\u9001',
            QuotaExceeded:
                '\u667A\u80FD\u4F53\u5DF2\u505C\u6B62\uFF1A\u5B83\u8BD5\u56FE\u521B\u5EFA\u8D85\u51FA\u5927\u5C0F\u9650\u5236\u7684\u6587\u4EF6\uFF0C\u6216\u6DFB\u52A0\u8D85\u51FA\u6570\u91CF\u9650\u5236\u7684\u7247\u6BB5\u3002\u6B64\u524D\u5DF2\u5B8C\u6210\u7684\u4FEE\u6539\u5DF2\u4FDD\u5B58\u5728\u6587\u6863\u4E2D',
            UnknownError: '\u51FA\u73B0\u95EE\u9898\uFF0C\u8BF7\u91CD\u8BD5',
            timeout:
                '\u667A\u80FD\u4F53\u672A\u80FD\u5728\u5341\u5206\u949F\u5185\u5B8C\u6210\uFF0C\u8BF7\u91CD\u8BD5',
            disconnected:
                '\u4E0E\u667A\u80FD\u4F53\u7684\u8FDE\u63A5\u5DF2\u65AD\u5F00\uFF0C\u8BF7\u91CD\u8BD5',
            connect_failed:
                '\u65E0\u6CD5\u8FDE\u63A5\u5230\u667A\u80FD\u4F53\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5',
            save_failed:
                '\u8FD0\u884C\u524D\u65E0\u6CD5\u4FDD\u5B58\u6587\u6863\u3002\u667A\u80FD\u4F53\u5C06\u57FA\u4E8E\u8FC7\u65F6\u7248\u672C\u5DE5\u4F5C\uFF0C\u56E0\u6B64\u5DF2\u53D6\u6D88\u8FD0\u884C',
            sync_failed:
                '\u4E0A\u6B21\u8FD0\u884C\u540E\u65E0\u6CD5\u4E0E\u670D\u52A1\u5668\u6838\u5BF9\u6587\u6863\u3002\u4E3A\u907F\u514D\u8986\u76D6\u667A\u80FD\u4F53\u7684\u4FEE\u6539\uFF0C\u5DF2\u53D6\u6D88\u8FD0\u884C\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5',
            aborted:
                '\u8FD0\u884C\u5DF2\u505C\u6B62\u3002\u667A\u80FD\u4F53\u5DF2\u4FEE\u6539\u4EE5\u4E0B\u4F4D\u7F6E\uFF0C\u8FD9\u4E9B\u4FEE\u6539\u4FDD\u7559\u5728\u6587\u6863\u4E2D\uFF1A',
            aborted_nothing:
                '\u8FD0\u884C\u5DF2\u505C\u6B62\uFF0C\u667A\u80FD\u4F53\u672A\u505A\u4EFB\u4F55\u4FEE\u6539',
            aborted_guest:
                '\u8FD0\u884C\u5DF2\u505C\u6B62\u3002\u672A\u767B\u5F55\u65F6\uFF0C\u667A\u80FD\u4F53\u7684\u4FEE\u6539\u4EC5\u5728\u8FD0\u884C\u7ED3\u675F\u65F6\u63D0\u4EA4\uFF0C\u56E0\u6B64\u7ED3\u679C\u5DF2\u5168\u90E8\u4E22\u5931\uFF0C\u6587\u6863\u4FDD\u6301\u539F\u6837',
            aborted_unsynced:
                '\u8FD0\u884C\u5DF2\u505C\u6B62\uFF0C\u4F46\u65E0\u6CD5\u91CD\u65B0\u8BFB\u53D6\u6587\u6863\uFF0C\u56E0\u6B64\u65E0\u6CD5\u786E\u5B9A\u667A\u80FD\u4F53\u505A\u4E86\u54EA\u4E9B\u4FEE\u6539\u3002\u8BF7\u5237\u65B0\u9875\u9762',
        },
        context_usage: '\u4E0A\u4E0B\u6587\u5DF2\u4F7F\u7528 {percent}%',
        context_usage_hint:
            '\u5DF2\u4F7F\u7528 {used} / {max} \u4E2A\u4E0A\u4E0B\u6587\u4EE3\u5E01',
        checkpoint: {
            region: '\u667A\u80FD\u4F53\u7684\u4FEE\u6539',
            accept: '\u63A5\u53D7',
            revert_count: {
                one: '\u64A4\u9500 {n} \u4E2A\u8BF7\u6C42',
                few: '\u64A4\u9500 {n} \u4E2A\u8BF7\u6C42',
                many: '\u64A4\u9500 {n} \u4E2A\u8BF7\u6C42',
                other: '\u64A4\u9500 {n} \u4E2A\u8BF7\u6C42',
            },
            revert_plain: '\u64A4\u9500\u4FEE\u6539',
            confirm_title: '\u64A4\u9500\u4FEE\u6539\uFF1F',
            confirm_text:
                '\u6587\u6863\u4E2D\u667A\u80FD\u4F53\u7684\u4FEE\u6539\u5C06\u88AB\u64A4\u9500\uFF0C\u9AD8\u4EAE\u663E\u793A\u7684\u8BF7\u6C42\u5C06\u4ECE\u5386\u53F2\u8BB0\u5F55\u4E2D\u5220\u9664\u3002\u6B64\u64CD\u4F5C\u65E0\u6CD5\u6062\u590D',
            confirm_text_plain:
                '\u6587\u6863\u4E2D\u667A\u80FD\u4F53\u7684\u4FEE\u6539\u5C06\u88AB\u64A4\u9500\u3002\u6B64\u64CD\u4F5C\u65E0\u6CD5\u6062\u590D',
            confirm_dont_ask: '\u4E0D\u518D\u8BE2\u95EE',
            cancel: '\u53D6\u6D88',
            history_failed:
                '\u4FEE\u6539\u5DF2\u64A4\u9500\uFF0C\u4F46\u90E8\u5206\u8BF7\u6C42\u65E0\u6CD5\u4ECE\u5386\u53F2\u8BB0\u5F55\u4E2D\u5220\u9664\u3002\u8BF7\u5237\u65B0\u9875\u9762',
            history_unavailable:
                '\u65E0\u6CD5\u52A0\u8F7D\u5386\u53F2\u8BB0\u5F55\uFF0C\u56E0\u6B64\u672A\u64A4\u9500\u4EFB\u4F55\u5185\u5BB9\u3002\u8BF7\u91CD\u8BD5',
            changes_count: {
                one: '\u5171 {n} \u5904\u4FEE\u6539',
                few: '\u5171 {n} \u5904\u4FEE\u6539',
                many: '\u5171 {n} \u5904\u4FEE\u6539',
                other: '\u5171 {n} \u5904\u4FEE\u6539',
            },
            settings_title: '\u64A4\u9500\u4FEE\u6539',
            mode_last: '\u6700\u540E\u4E00\u4E2A\u8BF7\u6C42',
            mode_range: '\u591A\u4E2A\u8BF7\u6C42',
            mode_hint:
                '\u6700\u540E\u4E00\u4E2A\u8BF7\u6C42\uFF1A\u53D1\u9001\u65B0\u8BF7\u6C42\u65F6\u4F1A\u63A5\u53D7\u4E4B\u524D\u7684\u4FEE\u6539\uFF0C\u56E0\u6B64\u53EA\u80FD\u64A4\u9500\u6700\u540E\u4E00\u4E2A\u8BF7\u6C42\u3002\u591A\u4E2A\u8BF7\u6C42\uFF1A\u4FEE\u6539\u4F1A\u7D2F\u79EF\uFF0C\u64A4\u9500\u65F6\u5C06\u5220\u9664\u81EA\u4E0A\u6B21\u65E0\u4FEE\u6539\u72B6\u6001\u4EE5\u6765\u7684\u6240\u6709\u8BF7\u6C42',
            confirm_setting: '\u64A4\u9500\u524D\u8BE2\u95EE',
        },
        steps_toggle: '\u667A\u80FD\u4F53\u6B65\u9AA4\uFF1A{count}',
        files: {
            drop_title: '\u5C06\u6587\u4EF6\u62D6\u5230\u6B64\u5904',
            drop_hint: '\u6216\u70B9\u51FB\u6DFB\u52A0\u5230\u6587\u6863',
            guest_hint:
                '\u767B\u5F55\u540E\u53EF\u4F7F\u7528\u6587\u4EF6\u529F\u80FD',
            upload: '\u4E0A\u4F20\u6587\u4EF6',
            mention:
                '\u5C06\u6211\u4E0A\u4F20\u7684\u6587\u4EF6 {name} \u6DFB\u52A0\u5230\u6587\u6863\u4E2D',
        },
    },
    mobile_view: {
        files: '\u6587\u4EF6',
        editor: '\u7F16\u8F91\u5668',
        pdf: 'PDF',
        chat: 'AI \u667A\u80FD\u4F53',
    },
    tokens_page: {
        title: '\u5145\u503C\u4EE3\u5E01\u4F59\u989D',
        subtitle:
            '\u4EE3\u5E01\u7528\u4E8E\u8BA1\u7B97\u3001AI \u751F\u6210\u4EE5\u53CA Labkeeper \u7684\u5176\u4ED6\u9AD8\u8D44\u6E90\u6D88\u8017\u529F\u80FD\u3002',
        balance_title: '\u4F60\u7684\u4F59\u989D',
        balance_caption: '\u53EF\u7528\u4EE3\u5E01',
        unauth_balance_caption:
            '\u767B\u5F55\u540E\u53EF\u67E5\u770B\u4F59\u989D\u5E76\u8D2D\u4E70\u4EE3\u5E01\u3002',
        buy_title: '\u9009\u62E9\u5957\u9910',
        buy_subtitle:
            '\u76EE\u524D\u8D2D\u4E70\u6D41\u7A0B\u4E3A\u6A21\u62DF\u6D41\u7A0B\uFF0C\u652F\u4ED8\u529F\u80FD\u5C06\u53E6\u884C\u63A5\u5165\u3002',
        buy_section_headline_lead: '\u4E00\u4E2A\u4F59\u989D',
        buy_section_headline_rest: '\u6EE1\u8DB3\u6240\u6709\u4EFB\u52A1',
        buy_section_intro:
            'Labkeeper \u91C7\u7528\u900F\u660E\u7684\u4EE3\u5E01\u4F53\u7CFB\u3002\u4EE3\u5E01\u662F\u5E73\u53F0\u7684\u901A\u7528\u8D27\u5E01\uFF1A\u4F60\u53EF\u4EE5\u6839\u636E\u9879\u76EE\u5F53\u524D\u7684\u9700\u8981\u7075\u6D3B\u5206\u914D\u8D44\u6E90\u2014\u2014\u4ECE AI \u8F85\u52A9\u5185\u5BB9\u751F\u6210\u5230\u7E41\u91CD\u7684\u670D\u52A1\u5668\u7AEF\u8BA1\u7B97\u3002\u53EA\u9700\u4E3A\u5B9E\u9645\u4F7F\u7528\u7684\u90E8\u5206\u4ED8\u8D39\u3002',
        buy_packages_heading: '\u5145\u503C\u9009\u9879\uFF1A',
        authenticated_buy_balance_prefix: '\u4F60\u7684\u4F59\u989D',
        package_quantity_label: '\u4EE3\u5E01\u6570\u91CF',
        package_card_subline_template: '{tokens}\uFF0C\u4EF7\u683C {price}',
        pricing_loading: '\u6B63\u5728\u52A0\u8F7D\u6700\u65B0\u4EF7\u683C...',
        pricing_error:
            '\u65E0\u6CD5\u52A0\u8F7D\u6700\u65B0\u4EF7\u683C\uFF0C\u8BF7\u5C1D\u8BD5\u5237\u65B0\u9875\u9762\u3002',
        pricing_empty:
            '\u76EE\u524D\u6CA1\u6709\u53EF\u7528\u7684\u4EE3\u5E01\u5957\u9910\u3002',
        buy_button: '\u8D2D\u4E70',
        popular: '\u70ED\u95E8',
        tokens_amount: '\u4EE3\u5E01',
        free_benefits: {
            initial_label: '\u6CE8\u518C\u65F6',
            initial_caption: '\u65B0\u8D26\u53F7\u7ACB\u5373\u5230\u8D26',
            refill_label: '\u5B9A\u671F\u5145\u503C',
            refill_caption: '\u6BCF{period}\u514D\u8D39\u53D1\u653E',
        },
        usage_title: '\u4EE3\u5E01\u7684\u7528\u9014',
        usage_items: [
            {
                heading: '\u4F7F\u7528 AI \u52A9\u624B\uFF08GPT\uFF09',
                body: '\u8BA9\u6A21\u578B\u4E3A\u6587\u6863\u62DF\u5B9A\u5927\u7EB2\u3001\u5C06\u6587\u672C\u8F6C\u6362\u4E3A Markdown\uFF0C\u6216\u627E\u51FA\u4EE3\u7801\u4E2D\u7684\u9519\u8BEF\u3002',
            },
            {
                heading: '\u670D\u52A1\u5668\u7AEF\u7F16\u8BD1',
                body: '\u6D41\u7545\u6784\u5EFA\u5927\u578B PDF \u6587\u6863\uFF0C\u4E0D\u518D\u5361\u987F\u3002\u4EC5\u5728\u9AD8\u6027\u80FD\u8FDC\u7A0B\u7F16\u8BD1\u5668\u8FD0\u884C\u671F\u95F4\u6263\u9664\u4EE3\u5E01\u3002',
            },
        ],
        usage_rates: {
            latex_compilation:
                'LaTeX \u7F16\u8BD1\uFF1A\u6BCF 1 \u79D2\u670D\u52A1\u5668\u65F6\u95F4 {tokens}\u3002',
            markdown_compilation:
                'Markdown \u7F16\u8BD1\uFF1A\u6BCF 1 \u79D2\u670D\u52A1\u5668\u65F6\u95F4 {tokens}\u3002',
            gpt_text_prompt:
                'GPT \u6587\u672C\u8BF7\u6C42\uFF1A\u6BCF 1 \u6B21\u8BF7\u6C42 {tokens}\u3002',
        },
        modal: {
            title: '\u8D2D\u4E70\u4EE3\u5E01',
            gateway_notice:
                '\u652F\u4ED8\u901A\u8FC7\u5B89\u5168\u7684 YuKassa \u652F\u4ED8\u7F51\u5173\u5904\u7406',
            consent_offer_prefix:
                '\u70B9\u51FB\u201C\u524D\u5F80\u652F\u4ED8\u201D\u6309\u94AE\uFF0C\u5373\u8868\u793A\u4F60\u63A5\u53D7',
            consent_offer_link: '\u516C\u5F00\u8981\u7EA6',
            consent_privacy_prefix:
                '\u70B9\u51FB\u201C\u524D\u5F80\u652F\u4ED8\u201D\uFF0C\u5373\u8868\u793A\u4F60\u540C\u610F',
            consent_privacy_link: '\u4E2A\u4EBA\u6570\u636E\u5904\u7406',
            consent_privacy_policy_prefix:
                '\u70B9\u51FB\u201C\u524D\u5F80\u652F\u4ED8\u201D\uFF0C\u5373\u8868\u793A\u4F60\u540C\u610F',
            consent_privacy_policy_link: '\u9690\u79C1\u653F\u7B56',
            pay_button: '\u524D\u5F80\u652F\u4ED8',
            payment_loading: '\u6B63\u5728\u521B\u5EFA\u652F\u4ED8...',
            payment_error:
                '\u65E0\u6CD5\u521B\u5EFA\u652F\u4ED8\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002',
            widget_error:
                '\u65E0\u6CD5\u6253\u5F00\u652F\u4ED8\u8868\u5355\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002',
        },
        navigation: {
            templates: '\u6A21\u677F',
            tokens: '\u4EE3\u5E01',
            blog: '\u77E5\u8BC6\u5E93',
            advantages: '\u4F18\u52BF',
            features: '\u529F\u80FD',
            about: '\u5173\u4E8E\u6211\u4EEC',
            login: '\u767B\u5F55',
            logout: '\u9000\u51FA\u767B\u5F55',
            editor: '\u7F16\u8F91\u5668',
            projects: '\u6211\u7684\u9879\u76EE',
        },
        footer: {
            copyright: `\u00A9 2024\u2014${new Date().getFullYear()}`,
            wiki_nav: '\u6587\u6863',
            nav_aria: '\u5B98\u7F51\u5BFC\u822A',
            contact_label: '\u8054\u7CFB\u65B9\u5F0F',
        },
    },
    compile_error: {
        [CompileError.CODE_NO_END_QUOTES]: '\u7F3A\u5C11\u53F3\u5F15\u53F7',
        [CompileError.UNKNOWN_SYMBOL]: '\u672A\u77E5\u7B26\u53F7',
        [CompileError.QUOTA_EXCEEDED]: '\u8D85\u51FA\u914D\u989D',
        [CompileError.OPERATOR_EXPECTED]:
            '\u6B64\u5904\u5E94\u4E3A\u8FD0\u7B97\u7B26',
        [CompileError.NUMBER_EXPECTED]: '\u6B64\u5904\u5E94\u4E3A\u6570\u5B57',
        [CompileError.NAME_EXPECTED]:
            '\u6B64\u5904\u5E94\u4E3A\u53D8\u91CF\u540D',
        [CompileError.NO_SUCH_VARIABLE]: '\u53D8\u91CF\u4E0D\u5B58\u5728',
        [CompileError.STRING_ARGUMENT_EXPECTED]:
            '\u53C2\u6570\u5E94\u4E3A\u5B57\u7B26\u4E32',
        [CompileError.ARRAY_ARGUMENT_EXPECTED]:
            '\u53C2\u6570\u5E94\u4E3A\u6570\u7EC4',
        [CompileError.NO_SUCH_FUNCTION]: '\u51FD\u6570\u4E0D\u5B58\u5728',
        [CompileError.ARITHMETIC_ERROR]: '\u9664\u4EE5\u96F6\u9519\u8BEF',
        [CompileError.CANCELED]: '\u8BA1\u7B97\u5DF2\u53D6\u6D88',
        [CompileError.NOT_ENOUGH_WORKERS]:
            '\u670D\u52A1\u5668\u8BA1\u7B97\u8D44\u6E90\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u7F16\u8BD1',
        [CompileError.INCORRECT_ARGUMENTS_COUNT]:
            '\u51FD\u6570\u53C2\u6570\u4E2A\u6570\u4E0D\u6B63\u786E\uFF1A',
        [CompileError.VARIABLE_INSERT_ERROR]:
            '\u5411 Markdown \u6587\u672C\u63D2\u5165\u53D8\u91CF\u65F6\u51FA\u9519',
        [CompileError.FILE_USAGE_NOT_ALLOWED]:
            '\u672A\u767B\u5F55\u65F6\u65E0\u6CD5\u4F7F\u7528\u6587\u4EF6',
        [CompileError.TOO_MUCH_FILES]:
            '\u5355\u4E2A\u9879\u76EE\u7684\u6587\u4EF6\u8FC7\u591A',
        [CompileError.INCORRECT_ARGUMENT_SIZE]:
            '\u51FD\u6570\u4E2D\u6570\u7EC4\u53C2\u6570\u7684\u957F\u5EA6\u4E0D\u6B63\u786E',
        [CompileError.INCORRECT_ARGUMENT]:
            '\u51FD\u6570\u4E2D\u53C2\u6570\u7684\u5927\u5C0F\u4E0D\u6B63\u786E',
        [CompileError.FUNCTION_HAS_NO_RETURN_VALUE]:
            '\u51FD\u6570\u6CA1\u6709\u8FD4\u56DE\u503C',
        [CompileError.MULTIPLE_ERROR]: '\u591A\u4E2A\u9519\u8BEF',
        [CompileError.LOGIN_REQUIRED]:
            '\u9700\u8981\u767B\u5F55\u624D\u80FD\u7EE7\u7EED',
        [CompileError.NAME_RESERVED]:
            'E \u548C PI \u4E0D\u80FD\u7528\u4F5C\u53D8\u91CF\u540D',
        [CompileError.INCORRECT_INFL_DEFINITION_ARRAY_SIZE]:
            '\u8BEF\u5DEE\u4E0D\u80FD\u8BBE\u7F6E\u4E3A\u6570\u7EC4',
        [CompileError.INCORRECT_INFL_DEFINITION_VALUE_WITH_INFL]:
            '\u4E0D\u80FD\u4E3A\u5DF2\u5E26\u6709\u8BEF\u5DEE\u7684\u503C\u8BBE\u7F6E\u8BEF\u5DEE',
        [CompileError.ARRAY_HAVE_ONLY_ZERO_VALUES]:
            '\u6570\u7EC4\u4E0D\u80FD\u53EA\u5305\u542B\u96F6\u503C\u3002\u8BF7\u68C0\u67E5\u6570\u7EC4\u8BEF\u5DEE\u548C\u820D\u5165\u6A21\u5F0F\u3002',
        [CompileError.LATEX_ERROR]: 'Latex \u9519\u8BEF',
    },
    error_common: {
        segment: '\u7247\u6BB5',
        file: '\u6587\u4EF6',
        common_errors: '\u5E38\u89C4\u9519\u8BEF',
        line: '\u884C',
        operator_expected: '\u6B64\u5904\u5E94\u4E3A\u8FD0\u7B97\u7B26',
        now: '\u5F53\u524D',
        max: '\u6700\u5927',
        new_line: '\u6362\u884C',
        variable: '\u53D8\u91CF',
    },
    authorization: {
        title: '\u767B\u5F55',
        loginVia: '\u901A\u8FC7\u4EE5\u4E0B\u65B9\u5F0F\u767B\u5F55',
        loginAndPasswoord: '\u8D26\u53F7\u548C\u5BC6\u7801',
        login: '\u767B\u5F55',
        loginInput: '\u8D26\u53F7',
        password: '\u5BC6\u7801',
        registration: '\u6CE8\u518C',
        forgotPassword: '\u5FD8\u8BB0\u5BC6\u7801\uFF1F',
        sendCode: '\u53D1\u9001\u9A8C\u8BC1\u7801',
        confirmCode: '\u786E\u8BA4\u9A8C\u8BC1\u7801',
        resendCode: '\u91CD\u65B0\u53D1\u9001\u9A8C\u8BC1\u7801',
        save: '\u4FDD\u5B58',
        confirmPassword: '\u786E\u8BA4\u5BC6\u7801',
        alreadyHaveAccount: '\u5DF2\u6709\u8D26\u53F7\uFF1F',
        createAccount: '\u521B\u5EFA\u8D26\u53F7',
        continue: '\u7EE7\u7EED',
        closeConfirmation: {
            title: '\u4E2D\u65AD\u5F53\u524D\u6D41\u7A0B\uFF1F',
            description:
                '\u5DF2\u8F93\u5165\u7684\u6570\u636E\u5C06\u4E22\u5931\uFF0C\u6CE8\u518C\u6216\u5BC6\u7801\u627E\u56DE\u6D41\u7A0B\u5C06\u88AB\u4E2D\u65AD\u3002',
            interrupt: '\u4E2D\u65AD',
            continue: '\u7EE7\u7EED',
        },
        personalDataAgreement:
            '\u6211\u540C\u610F\u6309\u7167\u4EE5\u4E0B\u6587\u4EF6\u5904\u7406\u6211\u7684\u4E2A\u4EBA\u6570\u636E\uFF1A',
        personalDataPolicyLink:
            '\u4E2A\u4EBA\u6570\u636E\u5904\u7406\u653F\u7B56',
        personalDataAgreementAnd: '\u548C',
        personalDataConsentLink:
            '\u4E2A\u4EBA\u6570\u636E\u5904\u7406\u540C\u610F\u4E66',
        views: {
            email: '\u8F93\u5165\u4F60\u7684\u90AE\u7BB1',
            code: '\u8F93\u5165\u9A8C\u8BC1\u7801',
            password: '\u8BBE\u7F6E\u5BC6\u7801',
            success: '\u6210\u529F',
            emailSubtitle:
                '\u6211\u4EEC\u5C06\u5411\u4F60\u7684\u90AE\u7BB1\u53D1\u9001\u9A8C\u8BC1\u7801',
            codeSubtitle:
                '\u8F93\u5165\u6211\u4EEC\u53D1\u9001\u5230\u4F60\u90AE\u7BB1\u7684\u9A8C\u8BC1\u7801',
            passwordSubtitle:
                '\u4E3A\u4F60\u7684\u8D26\u53F7\u8BBE\u7F6E\u4E00\u4E2A\u5F3A\u5BC6\u7801',
            successSubtitle:
                '\u4F60\u7684\u5BC6\u7801\u5DF2\u6210\u529F\u4FEE\u6539',
        },
        errors: {
            userExists: '\u8BE5\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C',
            userNotFound: '\u7528\u6237\u4E0D\u5B58\u5728',
            invalidEmail: '\u90AE\u7BB1\u683C\u5F0F\u65E0\u6548',
            captchaError:
                '\u4EBA\u673A\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5',
            invalidCode: '\u9A8C\u8BC1\u7801\u65E0\u6548',
            invalidPassword:
                '\u5BC6\u7801\u81F3\u5C11\u9700\u8981 8 \u4E2A\u5B57\u7B26',
            passwordsDontMatch:
                '\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4',
            fillAllFields: '\u8BF7\u586B\u5199\u6240\u6709\u5B57\u6BB5',
            passwordSetError: '\u8BBE\u7F6E\u5BC6\u7801\u65F6\u51FA\u9519',
            credentialsError: '\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF',
            oauthError:
                '\u901A\u8FC7\u7B2C\u4E09\u65B9\u670D\u52A1\u767B\u5F55\u65F6\u51FA\u9519',
            unknownError: '\u672A\u77E5\u9519\u8BEF',
        },
    },
    loginModal: {
        submit: '\u767B\u5F55',
        loginToProceed: '\u767B\u5F55\u4EE5\u7EE7\u7EED',
        description:
            '\u4F1A\u8BDD\u5DF2\u8FC7\u671F\uFF0C\u4F60\u5DF2\u9000\u51FA\u767B\u5F55',
    },
    quota_definition: {
        '1': '\u7247\u6BB5\u8FC7\u591A',
        '2': '\u6307\u6570\u8FD0\u7B97\u7B26\u8FC7\u591A',
        '3': '\u5B57\u7B26\u8FC7\u591A',
        '4': '\u51FD\u6570\u8FC7\u591A',
        '5': '\u5E38\u91CF\u8FC7\u5927',
        '6': '\u7A0B\u5E8F\u6267\u884C\u8D85\u65F6',
    },
    filemanager: {
        title: '\u6587\u4EF6',
        add: '\u6DFB\u52A0\u6587\u4EF6',
        dropzoneTitle: '\u5C06\u6587\u4EF6\u62D6\u653E\u5230\u6B64\u5904',
        root_folder: '\u4F60\u7684\u6587\u4EF6',
        drop_to_root:
            '\u5C06\u6587\u4EF6\u62D6\u653E\u5230\u201C\u4F60\u7684\u6587\u4EF6\u201D',
        drop_to_folder: '\u5C06\u6587\u4EF6\u62D6\u653E\u5230 ${path}',
        upload_target: '\u4E0A\u4F20\u5230\uFF1A${path}',
        delete: '\u5220\u9664',
        edit: '\u7F16\u8F91',
        your_files: '\u4F60\u7684\u6587\u4EF6',
        system_files: '\u7CFB\u7EDF\u6587\u4EF6',
        create_folder: '\u65B0\u5EFA\u6587\u4EF6\u5939',
        create_file: '\u65B0\u5EFA\u6587\u4EF6',
        empty: '\u6682\u65E0\u6587\u4EF6',
        errors: {
            tooMuchFiles:
                '\u5355\u4E2A\u9879\u76EE\u7684\u6587\u4EF6\u8FC7\u591A',
            tooBigFile:
                '\u6587\u4EF6\u8FC7\u5927\uFF0C\u6700\u5927\u4E3A ${replace1} MB',
            sessionExpired: '\u4F1A\u8BDD\u5DF2\u8FC7\u671F',
            notEnoughRights:
                '\u4F60\u6CA1\u6709\u67E5\u770B\u6B64\u9879\u76EE\u7684\u6743\u9650',
            internalError:
                '\u5185\u90E8\u9519\u8BEF\u3002\n\u6211\u4EEC\u6B63\u5728\u5904\u7406\uFF01',
            notSupported: '\u4E0D\u652F\u6301\u8BE5\u5A92\u4F53\u7C7B\u578B',
            notFound: '\u672A\u627E\u5230\u9879\u76EE',
            noNetwork: '\u65E0\u6CD5\u8FDE\u63A5\u5230\u670D\u52A1\u5668',
            bad_name:
                '\u540D\u79F0\u5305\u542B\u65E0\u6548\u5B57\u7B26\u6216\u8FC7\u957F',
            fileAlreadyExists: '\u5DF2\u5B58\u5728\u540C\u540D\u6587\u4EF6',
            rename_file_failed:
                '\u65E0\u6CD5\u91CD\u547D\u540D\u6587\u4EF6\uFF0C\u8BF7\u91CD\u8BD5',
            rename_folder_failed:
                '\u65E0\u6CD5\u91CD\u547D\u540D\u6587\u4EF6\u5939\uFF0C\u8BF7\u91CD\u8BD5',
            folder_locked:
                '\u8BE5\u6587\u4EF6\u5939\u6B63\u5728\u6267\u884C\u5176\u4ED6\u64CD\u4F5C\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5',
            upload_failed:
                '\u65E0\u6CD5\u4E0A\u4F20\u6587\u4EF6\uFF0C\u8BF7\u91CD\u8BD5',
        },
    },
    share_modal: {
        title: '\u5206\u4EAB',
        private_access: '\u4EC5\u81EA\u5DF1\u53EF\u8BBF\u95EE',
        public_access: '\u6240\u6709\u4EBA\u53EF\u8BBF\u95EE',
        copy_link: '\u590D\u5236\u5206\u4EAB\u94FE\u63A5',
        link_copied: '\u94FE\u63A5\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F',
        copy_error: '\u590D\u5236\u94FE\u63A5\u5931\u8D25',
    },
    delete_files_modal: {
        title: '\u4F60\u5DF2\u4ECE\u4EE3\u7801\u4E2D\u79FB\u9664\u6240\u6709\u6587\u4EF6\u5F15\u7528\u3002\u662F\u5426\u8981\u4ECE\u9879\u76EE\u4E2D\u5220\u9664\u4EE5\u4E0B\u6587\u4EF6\uFF1F',
    },
    privacy_policy_acceptance_modal: {
        title: '\u9690\u79C1\u653F\u7B56',
        description_prefix:
            '\u8981\u7EE7\u7EED\u4F7F\u7528 Labkeeper \u7F51\u7AD9\uFF0C\u8BF7\u9605\u8BFB',
        privacy_policy: '\u9690\u79C1\u653F\u7B56',
        description_middle: '\u5E76\u63A5\u53D7',
        personal_data_consent:
            '\u4E2A\u4EBA\u6570\u636E\u5904\u7406\u540C\u610F\u4E66',
        description_suffix: '\u3002',
        accept: '\u63A5\u53D7',
        error: '\u65E0\u6CD5\u4FDD\u5B58\u9690\u79C1\u653F\u7B56\u63A5\u53D7\u72B6\u6001\uFF0C\u8BF7\u91CD\u8BD5',
    },
    cross_border_consent_modal: {
        title: '\u5411 DeepSeek \u4F20\u8F93\u6570\u636E',
        consent_prefix:
            '\u6211\u540C\u610F\u5C06\u6211\u8F93\u5165\u7684\u6570\u636E',
        consent_link: '\u8DE8\u5883\u4F20\u8F93',
        consent_suffix:
            '\u81F3 DeepSeek \u670D\u52A1\uFF0C\u7528\u4E8E\u5904\u7406\u6211\u7684\u8BF7\u6C42\u5E76\u751F\u6210\u56DE\u590D',
        accept: '\u7EE7\u7EED',
        cancel: '\u53D6\u6D88',
    },
    wiki: 'wiki',
    readonly_public_project: '\u53EA\u8BFB\u516C\u5F00\u9879\u76EE',
    clone: '\u590D\u5236',
    contact_modal: {
        button: '\u8054\u7CFB\u6211\u4EEC',
        title: '\u8054\u7CFB\u6211\u4EEC',
        subject: '\u4E3B\u9898',
        subject_placeholder: '\u7B80\u8981\u63CF\u8FF0\u4E3B\u9898',
        message: '\u6D88\u606F',
        message_placeholder:
            '\u63CF\u8FF0\u4F60\u7684\u95EE\u9898\u6216\u5EFA\u8BAE',
        send: '\u53D1\u9001',
        cancel: '\u53D6\u6D88',
        warn: '\u8BF7\u586B\u5199\u4E3B\u9898\u548C\u6D88\u606F',
        err: '\u65E0\u6CD5\u6253\u5F00\u90AE\u4EF6\u5BA2\u6237\u7AEF',
        contact_email: '\u8054\u7CFB\u90AE\u7BB1',
        contact_form: '\u8054\u7CFB\u8868\u5355',
        agreement_prefix:
            '\u8054\u7CFB\u6211\u4EEC\u5373\u8868\u793A\u4F60\u5DF2\u77E5\u6089',
        privacy_policy: '\u9690\u79C1\u653F\u7B56',
        agreement_and: '\u548C',
        personal_data_consent:
            '\u4E2A\u4EBA\u6570\u636E\u5904\u7406\u540C\u610F\u4E66',
    },

    prompt_modal: {
        errors: {
            payment_required:
                '\u4F60\u9700\u8981\u5145\u503C\u4EE3\u5E01\u4F59\u989D\u3002',
        },
    },

    hunks: {
        accept: '\u63A5\u53D7\u4FEE\u6539',
        revert: '\u64A4\u9500\u4FEE\u6539',
        accept_add: '\u63A5\u53D7\u5E76\u6DFB\u52A0',
        accept_all: '\u5168\u90E8\u63A5\u53D7',
        revert_all: '\u5168\u90E8\u64A4\u9500',
        total_changes: '\u5171 {n} \u5904\u4FEE\u6539',
        new: '\u65B0\u589E',
        deleted: '\u5DF2\u5220\u9664',
        collapse_bar: '\u6536\u8D77\u4FEE\u6539\u680F',
        expand_bar: '\u5C55\u5F00\u4FEE\u6539\u680F',
        parameters_changed:
            '\u667A\u80FD\u4F53\u4FEE\u6539\u4E86\u53C2\u6570\uFF1A',
        parameter_yes: '\u662F',
        parameter_no: '\u5426',
        errors: {
            accept_failed:
                '\u90E8\u5206\u4FEE\u6539\u65E0\u6CD5\u63A5\u53D7\uFF0C\u8BF7\u91CD\u8BD5',
            revert_failed:
                '\u90E8\u5206\u4FEE\u6539\u65E0\u6CD5\u64A4\u9500\uFF0C\u8BF7\u91CD\u8BD5',
        },
    },

    contact_ok: '\u6211\u4EEC\u5DF2\u6536\u5230\u4F60\u7684\u53CD\u9988',
    contact_error: '\u53D1\u751F\u610F\u5916\u9519\u8BEF',
};
