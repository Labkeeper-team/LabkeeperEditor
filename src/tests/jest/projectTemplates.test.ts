import { ProjectTemplate } from '../../model/domain.ts';
import {
    availableTemplateFilters,
    filterTemplates,
    templateProjectType,
} from '../../viewModel/domain/projectTemplates.ts';

const template = (slug: string, categories: string[]): ProjectTemplate => ({
    slug,
    projectId: `${slug}-project`,
    title: slug,
    description: '',
    categories,
    path: `/templates/${slug}`,
});

const catalog = [
    template('altacv', ['latex', 'cv']),
    template('radiatsionnyi-fon', ['markdown', 'labs']),
    template('mdpi', ['latex', 'mdpi']),
];

test('тип проекта шаблона берётся из категорий', () => {
    expect(templateProjectType(catalog[0])).toBe('latex');
    expect(templateProjectType(catalog[1])).toBe('markdown');
    expect(templateProjectType(template('x', ['cv']))).toBeUndefined();
});

test('фильтры только те, под которые есть шаблоны, в порядке сайта', () => {
    expect(availableTemplateFilters(catalog)).toEqual(['labs', 'cv']);
    expect(availableTemplateFilters([])).toEqual([]);
});

test('журнальные шаблоны видны только среди всех', () => {
    expect(filterTemplates(catalog, 'all')).toBe(catalog);
    expect(filterTemplates(catalog, 'cv').map((item) => item.slug)).toEqual([
        'altacv',
    ]);
    expect(filterTemplates(catalog, 'labs').map((item) => item.slug)).toEqual([
        'radiatsionnyi-fon',
    ]);
});
