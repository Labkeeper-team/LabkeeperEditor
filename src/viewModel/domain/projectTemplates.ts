import { ProjectTemplate, ProjectType } from '../../model/domain.ts';

/** Темы, по которым каталог фильтруется на сайте; журналы видны только среди всех */
export const TEMPLATE_FILTERS = ['labs', 'diploma', 'cv'] as const;

export type TemplateFilter = (typeof TEMPLATE_FILTERS)[number];

/** Тип проекта шаблона лежит среди его категорий */
export const templateProjectType = (
    template: ProjectTemplate
): ProjectType | undefined => {
    if (template.categories.includes('markdown')) {
        return 'markdown';
    }
    if (template.categories.includes('latex')) {
        return 'latex';
    }
    return undefined;
};

/** Фильтры, под которые попадает хоть один шаблон, в порядке сайта */
export const availableTemplateFilters = (
    templates: ProjectTemplate[]
): TemplateFilter[] =>
    TEMPLATE_FILTERS.filter((filter) =>
        templates.some((template) => template.categories.includes(filter))
    );

export const filterTemplates = (
    templates: ProjectTemplate[],
    filter: TemplateFilter | 'all'
): ProjectTemplate[] =>
    filter === 'all'
        ? templates
        : templates.filter((template) => template.categories.includes(filter));
