/** Агентский режим: тот же проект по адресу с этим хвостом, /project/{id}/agent */
export const AGENT_MODE_SUFFIX = '/agent';

/** Сервисам режим виден только по адресу: раскладку выбирает страница */
export const isAgentModePath = (path: string): boolean =>
    path.replace(/\/+$/, '').endsWith(AGENT_MODE_SUFFIX);
