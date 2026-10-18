import { useDispatch, useSelector } from 'react-redux';

import { Modal } from '../../../components/modal';
import { AppDispatch, StorageState } from '../../../store';
import { setShowHotkeysHelp } from '../../../store/slices/settings';
import { useDictionary } from '../../../store/selectors/translations';
import { EXISTING_HOTKEYS, PROJECT_HOTKEYS } from './catalog.ts';
import { Keys } from './Keys.tsx';

import './style.scss';

type Row = { label: string; hotkeys: readonly string[] };

/** GH-172: плашка со всеми сочетаниями страницы проекта, новыми и прежними. Esc закрывает её как любое окно */
export const HotkeysHelpModal = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const show = useSelector(
        (state: StorageState) => state.settings.showHotkeysHelp
    );
    const text = dictionary.hotkeys;
    const actions = text.actions;

    const sections: { title: string; rows: Row[] }[] = [
        {
            title: text.sections.project,
            rows: [
                {
                    label: actions.search_open,
                    hotkeys: [PROJECT_HOTKEYS.search_open],
                },
                {
                    label: actions.search_step,
                    hotkeys: [
                        PROJECT_HOTKEYS.search_next,
                        PROJECT_HOTKEYS.search_prev,
                    ],
                },
                {
                    label: actions.file_manager,
                    hotkeys: [PROJECT_HOTKEYS.file_manager],
                },
                {
                    label: actions.sync_to_pdf,
                    hotkeys: [PROJECT_HOTKEYS.sync_to_pdf],
                },
                {
                    label: actions.sync_to_editor,
                    hotkeys: [PROJECT_HOTKEYS.sync_to_editor],
                },
                {
                    label: actions.segment_step,
                    hotkeys: [
                        PROJECT_HOTKEYS.segment_prev,
                        PROJECT_HOTKEYS.segment_next,
                    ],
                },
                {
                    label: actions.add_latex,
                    hotkeys: [PROJECT_HOTKEYS.add_latex],
                },
                { label: actions.compile, hotkeys: [PROJECT_HOTKEYS.compile] },
                {
                    label: actions.send_errors_to_agent,
                    hotkeys: [PROJECT_HOTKEYS.send_errors_to_agent],
                },
                {
                    label: actions.viewer_pdf,
                    hotkeys: [PROJECT_HOTKEYS.viewer_pdf],
                },
                {
                    label: actions.viewer_chat,
                    hotkeys: [PROJECT_HOTKEYS.viewer_chat],
                },
                {
                    label: actions.agent_mode,
                    hotkeys: [PROJECT_HOTKEYS.agent_mode],
                },
            ],
        },
        {
            title: text.sections.editing,
            rows: [
                { label: actions.save, hotkeys: EXISTING_HOTKEYS.save },
                { label: actions.undo, hotkeys: EXISTING_HOTKEYS.undo },
                { label: actions.redo, hotkeys: EXISTING_HOTKEYS.redo },
                { label: actions.escape, hotkeys: EXISTING_HOTKEYS.escape },
            ],
        },
        {
            title: text.sections.chat,
            rows: [
                {
                    label: actions.chat_send,
                    hotkeys: EXISTING_HOTKEYS.chat_send,
                },
                {
                    label: actions.chat_newline,
                    hotkeys: EXISTING_HOTKEYS.chat_newline,
                },
                {
                    label: actions.chat_mode,
                    hotkeys: EXISTING_HOTKEYS.chat_mode,
                },
            ],
        },
    ];

    return (
        <Modal
            showModal={show}
            onClose={() => dispatch(setShowHotkeysHelp(false))}
        >
            <div className="hotkeys-help" role="dialog" aria-label={text.title}>
                <h2 className="hotkeys-help__title">{text.title}</h2>
                {sections.map((section) => (
                    <section
                        key={section.title}
                        className="hotkeys-help__section"
                    >
                        <h3 className="hotkeys-help__section-title">
                            {section.title}
                        </h3>
                        <dl className="hotkeys-help__list">
                            {section.rows.map((row) => (
                                <div
                                    key={row.label}
                                    className="hotkeys-help__row"
                                >
                                    <dt>{row.label}</dt>
                                    <dd>
                                        <Keys
                                            className="hotkeys-help__keys"
                                            hotkeys={row.hotkeys}
                                        />
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                ))}
            </div>
        </Modal>
    );
};
