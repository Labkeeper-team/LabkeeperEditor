export type TagInfo = {
    label: string;
    color: string;
};

type ProjectTagsStorage = {
    projects: Record<string, string[]>;
    tags: Record<string, TagInfo>;
};

const STORAGE_KEY = 'labkeeper-project-tags-v1';
const DEFAULT_NEW_TAG_COLOR = 'blue';
const TAG_COLOR_SWATCHES = [
    'blue',
    'orange',
    'red',
    'purple',
    'cyan',
    'lime',
    'deeppink',
    'deepskyblue',
    'darkorange',
    'green',
    'violet',
    'teal',
    'yellow',
    'indigo',
    'pink',
    'olive',
];

const collator = new Intl.Collator(['ru', 'en'], {
    sensitivity: 'base',
    numeric: true,
});

const normalizeTag = (tag: string): string => tag.trim().replace(/\s+/g, ' ');
const toTagKey = (tag: string): string => normalizeTag(tag).toLocaleLowerCase();

const normalizeColor = (color: string): string | null => {
    const value = color.trim();
    if (!value) {
        return null;
    }
    if (typeof window !== 'undefined' && window.CSS?.supports) {
        if (!window.CSS.supports('color', value)) {
            return null;
        }
    }
    return value;
};

const normalizeTagKeys = (tagKeys: string[]): string[] => {
    const unique = new Set<string>();
    for (const tagKey of tagKeys) {
        const normalizedKey = toTagKey(tagKey);
        if (normalizedKey) {
            unique.add(normalizedKey);
        }
    }
    return Array.from(unique);
};

const getNextSuggestedTagColor = (
    knownColors: string[],
    currentColor?: string
): string => {
    const normalizedKnown = new Set(
        knownColors.map((color) => color.toLocaleLowerCase())
    );
    const paletteSize = TAG_COLOR_SWATCHES.length;
    const currentIndex = currentColor
        ? TAG_COLOR_SWATCHES.findIndex(
              (color) =>
                  color.toLocaleLowerCase() === currentColor.toLocaleLowerCase()
          )
        : -1;

    for (let step = 1; step <= paletteSize; step += 1) {
        const index = (currentIndex + step) % paletteSize;
        const candidate = TAG_COLOR_SWATCHES[index];
        if (!normalizedKnown.has(candidate.toLocaleLowerCase())) {
            return candidate;
        }
    }

    return TAG_COLOR_SWATCHES[(currentIndex + 1) % paletteSize];
};

const collectKnownTagKeys = (
    projects: Record<string, string[]>
): Set<string> => {
    const keys = new Set<string>();
    for (const tags of Object.values(projects)) {
        for (const tagKey of tags) {
            keys.add(toTagKey(tagKey));
        }
    }
    return keys;
};

const toTagInfo = (value: unknown): TagInfo | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const record = value as { label?: unknown; color?: unknown };
    if (typeof record.label !== 'string' || typeof record.color !== 'string') {
        return null;
    }
    const label = normalizeTag(record.label);
    const color = normalizeColor(record.color);
    if (!label || !color) {
        return null;
    }
    return { label, color };
};

export class ProjectTagsStubService {
    private sortProjectTagKeys(
        tagKeys: string[],
        tags: Record<string, TagInfo>
    ): string[] {
        return [...tagKeys].sort((a, b) =>
            collator.compare(tags[a]?.label ?? a, tags[b]?.label ?? b)
        );
    }

    private ensureTagInfos(storage: ProjectTagsStorage): boolean {
        const knownTagKeys = Array.from(collectKnownTagKeys(storage.projects));
        const assignedColors: string[] = [];
        let changed = false;

        for (const key of Object.keys(storage.tags)) {
            if (!knownTagKeys.includes(key)) {
                delete storage.tags[key];
                changed = true;
            }
        }

        for (const tagKey of knownTagKeys) {
            const known = storage.tags[tagKey];
            const normalizedColor = known ? normalizeColor(known.color) : null;
            if (known && normalizedColor) {
                const normalizedLabel = normalizeTag(known.label) || tagKey;
                if (
                    normalizedLabel !== known.label ||
                    normalizedColor !== known.color
                ) {
                    storage.tags[tagKey] = {
                        label: normalizedLabel,
                        color: normalizedColor,
                    };
                    changed = true;
                }
                assignedColors.push(storage.tags[tagKey].color);
                continue;
            }

            const currentColor =
                assignedColors.length > 0
                    ? assignedColors[assignedColors.length - 1]
                    : undefined;
            const nextColor = getNextSuggestedTagColor(
                assignedColors,
                currentColor
            );
            storage.tags[tagKey] = {
                label: known?.label
                    ? normalizeTag(known.label) || tagKey
                    : tagKey,
                color: nextColor || DEFAULT_NEW_TAG_COLOR,
            };
            assignedColors.push(storage.tags[tagKey].color);
            changed = true;
        }

        for (const projectId of Object.keys(storage.projects)) {
            const sorted = this.sortProjectTagKeys(
                normalizeTagKeys(storage.projects[projectId] ?? []),
                storage.tags
            );
            const current = storage.projects[projectId] ?? [];
            if (
                sorted.length !== current.length ||
                sorted.some((key, index) => key !== current[index])
            ) {
                storage.projects[projectId] = sorted;
                changed = true;
            }
        }

        return changed;
    }

    private readStorage(): ProjectTagsStorage {
        if (typeof window === 'undefined') {
            return { projects: {}, tags: {} };
        }

        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return { projects: {}, tags: {} };
            }

            const parsed = JSON.parse(raw) as {
                projects?: unknown;
                tags?: unknown;
                colors?: unknown;
            };
            const rawProjects =
                parsed.projects && typeof parsed.projects === 'object'
                    ? (parsed.projects as Record<string, unknown>)
                    : {};
            const rawTags =
                parsed.tags && typeof parsed.tags === 'object'
                    ? (parsed.tags as Record<string, unknown>)
                    : {};
            const rawLegacyColors =
                parsed.colors && typeof parsed.colors === 'object'
                    ? (parsed.colors as Record<string, unknown>)
                    : {};

            const tags: Record<string, TagInfo> = {};
            for (const [key, value] of Object.entries(rawTags)) {
                const normalizedKey = toTagKey(key);
                const info = toTagInfo(value);
                if (normalizedKey && info && !tags[normalizedKey]) {
                    tags[normalizedKey] = info;
                }
            }

            const projects: Record<string, string[]> = {};
            for (const [projectId, value] of Object.entries(rawProjects)) {
                if (!Array.isArray(value)) {
                    continue;
                }
                const keys: string[] = [];
                for (const item of value) {
                    if (typeof item !== 'string') {
                        continue;
                    }
                    const normalizedLabel = normalizeTag(item);
                    if (!normalizedLabel) {
                        continue;
                    }
                    const tagKey = toTagKey(normalizedLabel);
                    keys.push(tagKey);
                    if (!tags[tagKey]) {
                        const legacyColorValue = rawLegacyColors[tagKey];
                        const legacyColor =
                            typeof legacyColorValue === 'string'
                                ? normalizeColor(legacyColorValue)
                                : null;
                        tags[tagKey] = {
                            label: normalizedLabel,
                            color: legacyColor ?? DEFAULT_NEW_TAG_COLOR,
                        };
                    }
                }
                projects[projectId] = keys;
            }

            const storage: ProjectTagsStorage = { projects, tags };
            this.ensureTagInfos(storage);
            return storage;
        } catch {
            return { projects: {}, tags: {} };
        }
    }

    private saveStorage(storage: ProjectTagsStorage): void {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    }

    getProjectTagKeys(projectIds: string[]): Record<string, string[]> {
        const storage = this.readStorage();
        const knownIds = new Set(projectIds);
        const result: Record<string, string[]> = {};
        let changed = false;

        for (const projectId of Object.keys(storage.projects)) {
            if (!knownIds.has(projectId)) {
                delete storage.projects[projectId];
                changed = true;
            }
        }

        for (const projectId of projectIds) {
            const normalizedKeys = normalizeTagKeys(
                storage.projects[projectId] ?? []
            );
            const sortedKeys = this.sortProjectTagKeys(
                normalizedKeys,
                storage.tags
            );
            const current = storage.projects[projectId] ?? [];
            if (
                sortedKeys.length !== current.length ||
                sortedKeys.some((key, index) => key !== current[index])
            ) {
                storage.projects[projectId] = sortedKeys;
                changed = true;
            }
        }

        if (this.ensureTagInfos(storage)) {
            changed = true;
        }

        for (const projectId of projectIds) {
            result[projectId] = [...(storage.projects[projectId] ?? [])];
        }

        if (changed) {
            this.saveStorage(storage);
        }

        return result;
    }

    getTagMap(projectIds?: string[]): Record<string, TagInfo> {
        const storage = this.readStorage();
        let changed = false;
        if (this.ensureTagInfos(storage)) {
            changed = true;
        }

        const ids = projectIds ?? Object.keys(storage.projects);
        const allowedTagKeys = new Set(
            ids
                .flatMap((id) => storage.projects[id] ?? [])
                .map((key) => toTagKey(key))
        );
        const result: Record<string, TagInfo> = {};
        for (const key of allowedTagKeys) {
            const info = storage.tags[key];
            if (info) {
                result[key] = { ...info };
            }
        }

        if (changed) {
            this.saveStorage(storage);
        }

        return result;
    }

    addTagToProject(projectId: string, tag: string, color?: string): string[] {
        const normalizedLabel = normalizeTag(tag);
        if (!normalizedLabel) {
            const storage = this.readStorage();
            return [...(storage.projects[projectId] ?? [])];
        }

        const storage = this.readStorage();
        const tagKey = toTagKey(normalizedLabel);
        const currentKeys = storage.projects[projectId] ?? [];
        storage.projects[projectId] = this.sortProjectTagKeys(
            normalizeTagKeys([...currentKeys, tagKey]),
            storage.tags
        );

        const existing = storage.tags[tagKey];
        if (!existing) {
            const normalizedColor =
                typeof color === 'string' ? normalizeColor(color) : null;
            storage.tags[tagKey] = {
                label: normalizedLabel,
                color: normalizedColor ?? DEFAULT_NEW_TAG_COLOR,
            };
        } else if (!existing.label) {
            storage.tags[tagKey] = { ...existing, label: normalizedLabel };
        }

        this.ensureTagInfos(storage);
        this.saveStorage(storage);
        return [...(storage.projects[projectId] ?? [])];
    }

    removeTagFromProject(projectId: string, tag: string): string[] {
        const normalized = normalizeTag(tag);
        const removedKey = toTagKey(normalized);
        const storage = this.readStorage();
        const currentKeys = storage.projects[projectId] ?? [];
        storage.projects[projectId] = normalizeTagKeys(
            currentKeys.filter((key) => toTagKey(key) !== removedKey)
        );

        const stillExists = Object.values(storage.projects).some((keys) =>
            keys.some((key) => toTagKey(key) === removedKey)
        );
        if (!stillExists) {
            delete storage.tags[removedKey];
        }

        this.ensureTagInfos(storage);
        this.saveStorage(storage);
        return [...(storage.projects[projectId] ?? [])];
    }
}
