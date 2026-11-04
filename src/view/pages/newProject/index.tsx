import classNames from 'classnames';
import {
    ChangeEvent,
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { controller } from '../../../main.tsx';
import {
    PROJECT_TITLE_MAX_LENGTH,
    ProjectTemplate,
    ProjectType,
} from '../../../model/domain.ts';
import {
    availableTemplateFilters,
    filterTemplates,
    TemplateFilter,
    templateProjectType,
} from '../../../viewModel/domain/projectTemplates.ts';
import {
    archiveProjectName,
    isZipArchive,
} from '../../../viewModel/domain/projectArchive.ts';
import { Routes } from '../../../viewModel/routes.ts';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import { PlusIcon, RightArrowIcon } from '../../icons';
import { AppDispatch, StorageState } from '../../store';
import { useDictionary } from '../../store/selectors/translations';
import './style.scss';

const PROJECT_TYPES: ProjectType[] = ['latex', 'markdown'];

/** Архив со стрелкой наверх: проект приходит из файла */
const ArchiveIcon = () => (
    <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
        <path d="M3 4h18v4H3z" />
        <path d="M12 17v-6M9.5 13.5 12 11l2.5 2.5" />
    </svg>
);

const TemplatePreview = ({
    template,
    typeLabel,
}: {
    template: ProjectTemplate;
    typeLabel?: string;
}) => {
    // картинки лежат на сайте, при разработке их нет: тогда остаётся подпись типа
    const [broken, setBroken] = useState(false);
    if (!template.previewImage || broken) {
        return (
            <span className="new-project__preview-placeholder">
                {typeLabel}
            </span>
        );
    }
    return (
        <img
            className="new-project__preview-image"
            src={template.previewImage}
            alt=""
            loading="lazy"
            // GH-232: карточка это кнопка выбора, утащить из неё картинку нельзя
            draggable={false}
            onError={() => setBroken(true)}
        />
    );
};

/**
 * GH-217: новый проект создаётся на отдельной странице. Пустой проект
 * создаётся с выбранным типом, проект из шаблона клонируется, и тип у него
 * тот, что у шаблона. GH-234: проект из архива импортируется, тип берётся
 * из архива
 */
export const NewProjectPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const texts = dictionary.new_project;
    const templates = useSelector(
        (state: StorageState) => state.projects.templates
    );
    const templatesRequestState = useSelector(
        (state: StorageState) => state.projects.templatesRequestState
    );

    const [name, setName] = useState('');
    // имя, подставленное из шаблона или архива, меняется вместе с ними, а введённое остаётся
    const [nameFromSource, setNameFromSource] = useState(false);
    const [projectType, setProjectType] = useState<ProjectType>('latex');
    const [templateSlug, setTemplateSlug] = useState<string | null>(null);
    const [archive, setArchive] = useState<File | null>(null);
    const archiveInputRef = useRef<HTMLInputElement>(null);
    const [filter, setFilter] = useState<TemplateFilter | 'all'>('all');
    const [agentMode, setAgentMode] = useState(false);
    const [error, setError] = useState<string>();
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        dispatch(controller.onNewProjectPageOpenedRequest());
    }, [dispatch]);

    const template = templates.find((item) => item.slug === templateSlug);
    // тип архива узнаем только после импорта, до тех пор не подсвечен ни один
    const shownType = template
        ? templateProjectType(template)
        : archive
          ? undefined
          : projectType;
    const typeFixed = Boolean(template || archive);
    const filters = useMemo(
        () => availableTemplateFilters(templates),
        [templates]
    );
    const shownTemplates = useMemo(
        () => filterTemplates(templates, filter),
        [templates, filter]
    );

    const typeLabel = (type?: ProjectType) =>
        type === 'markdown'
            ? texts.type_markdown
            : type === 'latex'
              ? texts.type_latex
              : undefined;

    const nameFrom = (sourceName: string | null) => {
        if (!name.trim() || nameFromSource) {
            setName(sourceName ?? '');
            setNameFromSource(sourceName !== null);
        }
    };

    const chooseTemplate = (next: ProjectTemplate | null) => {
        setTemplateSlug(next?.slug ?? null);
        setArchive(null);
        setError(undefined);
        nameFrom(next?.title.slice(0, PROJECT_TITLE_MAX_LENGTH) ?? null);
    };

    const chooseArchive = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // тот же файл можно выбрать снова, например после ошибки
        event.target.value = '';
        if (!file) {
            return;
        }
        if (!isZipArchive(file)) {
            setError(texts.error.archive_invalid);
            return;
        }
        setArchive(file);
        setTemplateSlug(null);
        setError(undefined);
        nameFrom(archiveProjectName(file.name) || null);
    };

    const onCreate = useCallback(
        (event?: FormEvent) => {
            event?.preventDefault();
            if (creating) {
                return;
            }
            setCreating(true);
            setError(undefined);
            dispatch(
                controller.onProjectCreateRequest({
                    projectName: name,
                    projectType,
                    template,
                    archive: archive ?? undefined,
                    agentMode,
                    onFinished: (message) => {
                        setCreating(false);
                        setError(message);
                    },
                })
            );
        },
        [agentMode, archive, creating, dispatch, name, projectType, template]
    );

    return (
        <form className="new-project" onSubmit={onCreate} noValidate>
            <div className="new-project__scroll">
                <div className="new-project__content">
                    <Link className="new-project__back" to={Routes.Projects}>
                        ← {texts.back}
                    </Link>
                    <h1 className="new-project__title">{texts.title}</h1>

                    {/* GH-234: проект из архива экспорта или из zip с main.tex.
                        Это не шаблон, поэтому у импорта своё место над формой */}
                    <div
                        className={classNames('new-project__archive', {
                            'new-project__archive--active': !!archive,
                        })}
                        role="group"
                        aria-label={texts.archive}
                    >
                        <span className="new-project__archive-icon">
                            <ArchiveIcon />
                        </span>
                        <span className="new-project__archive-text">
                            <span className="new-project__archive-title">
                                {archive?.name ?? texts.archive}
                            </span>
                            <span className="new-project__archive-hint">
                                {texts.archive_hint}
                            </span>
                        </span>
                        <span className="new-project__archive-actions">
                            <button
                                type="button"
                                className="new-project__archive-choose"
                                onClick={() => archiveInputRef.current?.click()}
                            >
                                {archive
                                    ? texts.archive_replace
                                    : texts.archive_choose}
                            </button>
                            {archive && (
                                <button
                                    type="button"
                                    className="new-project__archive-remove"
                                    onClick={() => chooseTemplate(null)}
                                >
                                    {texts.archive_remove}
                                </button>
                            )}
                        </span>
                        <input
                            ref={archiveInputRef}
                            className="new-project__archive-input"
                            type="file"
                            accept=".zip,application/zip"
                            tabIndex={-1}
                            aria-hidden="true"
                            onChange={chooseArchive}
                        />
                    </div>

                    <Input
                        className="new-project__name"
                        title={texts.name}
                        value={name}
                        onChange={(event) => {
                            setName(event.target.value);
                            setNameFromSource(false);
                            setError(undefined);
                        }}
                        maxLength={PROJECT_TITLE_MAX_LENGTH}
                        showCharacterCount
                        enterKeyHint="done"
                    />

                    <section className="new-project__section">
                        <h2 className="new-project__heading">
                            {texts.project_type}
                        </h2>
                        <div
                            className="new-project__types"
                            role="group"
                            aria-label={texts.project_type}
                        >
                            {PROJECT_TYPES.map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    className={classNames('new-project__type', {
                                        'new-project__type--active':
                                            shownType === type,
                                    })}
                                    aria-pressed={shownType === type}
                                    disabled={typeFixed}
                                    onClick={() => setProjectType(type)}
                                >
                                    <span className="new-project__type-name">
                                        {typeLabel(type)}
                                    </span>
                                    <span className="new-project__type-hint">
                                        {type === 'latex'
                                            ? texts.type_latex_hint
                                            : texts.type_markdown_hint}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {/* GH-232: место под подсказку есть всегда, иначе
                            выбор шаблона сдвигал карточки под курсором */}
                        <p
                            className={classNames('new-project__note', {
                                'new-project__note--hidden': !typeFixed,
                            })}
                            aria-hidden={!typeFixed}
                        >
                            {archive
                                ? texts.type_from_archive
                                : texts.type_from_template}
                        </p>
                    </section>

                    <section className="new-project__section">
                        <h2 className="new-project__heading">
                            {texts.template}
                        </h2>
                        {filters.length > 0 && (
                            <div className="new-project__filters" role="group">
                                {(['all', ...filters] as const).map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        className={classNames(
                                            'new-project__filter',
                                            {
                                                'new-project__filter--active':
                                                    filter === item,
                                            }
                                        )}
                                        aria-pressed={filter === item}
                                        onClick={() => setFilter(item)}
                                    >
                                        {item === 'all'
                                            ? texts.all_templates
                                            : texts.categories[item]}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="new-project__templates">
                            <div
                                className={classNames('new-project__card', {
                                    'new-project__card--active': !typeFixed,
                                })}
                            >
                                <button
                                    type="button"
                                    className="new-project__card-select"
                                    aria-pressed={!typeFixed}
                                    onClick={() => chooseTemplate(null)}
                                >
                                    <span className="new-project__preview new-project__preview--empty">
                                        <PlusIcon aria-hidden />
                                    </span>
                                    <span className="new-project__card-title">
                                        {texts.empty_project}
                                    </span>
                                    <span className="new-project__card-text">
                                        {texts.empty_project_hint}
                                    </span>
                                </button>
                            </div>
                            {shownTemplates.map((item) => (
                                <div
                                    key={item.slug}
                                    className={classNames('new-project__card', {
                                        'new-project__card--active':
                                            item.slug === templateSlug,
                                    })}
                                    data-template={item.slug}
                                >
                                    <button
                                        type="button"
                                        className="new-project__card-select"
                                        aria-pressed={
                                            item.slug === templateSlug
                                        }
                                        onClick={() => chooseTemplate(item)}
                                    >
                                        <span className="new-project__preview">
                                            <TemplatePreview
                                                template={item}
                                                typeLabel={typeLabel(
                                                    templateProjectType(item)
                                                )}
                                            />
                                        </span>
                                        <span className="new-project__card-type">
                                            {typeLabel(
                                                templateProjectType(item)
                                            )}
                                        </span>
                                        <span className="new-project__card-title">
                                            {item.title}
                                        </span>
                                        <span className="new-project__card-text">
                                            {item.description}
                                        </span>
                                    </button>
                                    <a
                                        className="new-project__card-link"
                                        href={item.path}
                                        target="_blank"
                                        rel="noopener"
                                        draggable={false}
                                    >
                                        {texts.template_page} ↗
                                    </a>
                                </div>
                            ))}
                        </div>
                        {templatesRequestState === 'loading' && (
                            <p className="new-project__status">
                                {texts.templates_loading}
                            </p>
                        )}
                        {templatesRequestState === 'error' && (
                            <p className="new-project__status">
                                {texts.templates_error}{' '}
                                <button
                                    type="button"
                                    className="new-project__retry"
                                    onClick={() =>
                                        dispatch(
                                            controller.onNewProjectPageOpenedRequest()
                                        )
                                    }
                                >
                                    {texts.templates_retry}
                                </button>
                            </p>
                        )}
                    </section>
                </div>
            </div>

            <div className="new-project__footer">
                <label className="new-project__agent">
                    <input
                        type="checkbox"
                        checked={agentMode}
                        onChange={(event) => setAgentMode(event.target.checked)}
                    />
                    <span className="new-project__agent-text">
                        <span className="new-project__agent-title">
                            {texts.agent_mode}
                        </span>
                        <span className="new-project__agent-hint">
                            {texts.agent_mode_hint}
                        </span>
                    </span>
                </label>
                <div className="new-project__submit">
                    {error && (
                        <span className="new-project__error" role="alert">
                            {error}
                        </span>
                    )}
                    <Button
                        classname="new-project__create"
                        buttonType="submit"
                        title={creating ? texts.creating : texts.create}
                        titleIcon={() => <RightArrowIcon />}
                        disabled={creating || !name.trim()}
                        color="green"
                        rounded
                        minimize={false}
                    />
                </div>
            </div>
        </form>
    );
};
