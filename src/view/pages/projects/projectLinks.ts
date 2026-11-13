import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { format, formatDistanceToNow } from 'date-fns';
import { enGB, ru, zhCN } from 'date-fns/locale';

import { Routes } from '../../../viewModel/routes.ts';
import { useCurrentLanguage } from '../../store/selectors/translations';

/** Подписи типов, адрес проекта и его время для строк, карточек и меню */

export const PROJECT_TYPE_LABELS: Record<string, string> = {
    latex: 'LaTeX',
    markdown: 'Markdown',
};

export const projectHref = (projectId?: string) =>
    Routes.Project.replace(':id', projectId ?? '');

const toDate = (value?: string): Date | null => {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

/** «3 дня назад» и точная дата для подсказки, на языке интерфейса */
export const useProjectTimes = () => {
    const lang = useSelector(useCurrentLanguage);
    return useMemo(() => {
        const locale = lang === 'ru' ? ru : lang === 'zh' ? zhCN : enGB;
        return {
            relative: (value?: string) => {
                const date = toDate(value);
                return date
                    ? formatDistanceToNow(date, { addSuffix: true, locale })
                    : '—';
            },
            full: (value?: string) => {
                const date = toDate(value);
                return date ? format(date, 'PPp', { locale }) : undefined;
            },
        };
    }, [lang]);
};
