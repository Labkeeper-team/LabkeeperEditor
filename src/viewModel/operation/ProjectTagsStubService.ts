type ProjectTagsStorage = {
    projects: Record<string, string[]>;
};

const STORAGE_KEY = 'labkeeper-project-tags-v1';

const collator = new Intl.Collator(['ru', 'en'], {
    sensitivity: 'base',
    numeric: true,
});

const normalizeTag = (tag: string): string => tag.trim().replace(/\s+/g, ' ');

const sortTags = (tags: string[]): string[] =>
    tags.sort((a, b) => collator.compare(a, b));

const uniqTags = (tags: string[]): string[] => {
    const unique = new Map<string, string>();
    for (const tag of tags) {
        const normalized = normalizeTag(tag);
        if (!normalized) {
            continue;
        }
        const key = normalized.toLocaleLowerCase();
        if (!unique.has(key)) {
            unique.set(key, normalized);
        }
    }
    return sortTags(Array.from(unique.values()));
};

export class ProjectTagsStubService {
    private readStorage(): ProjectTagsStorage {
        if (typeof window === 'undefined') {
            return { projects: {} };
        }
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return { projects: {} };
            }
            const parsed = JSON.parse(raw) as ProjectTagsStorage;
            return {
                projects: parsed.projects ?? {},
            };
        } catch {
            return { projects: {} };
        }
    }

    private saveStorage(storage: ProjectTagsStorage): void {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    }

    getProjectTags(projectIds: string[]): Record<string, string[]> {
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
            result[projectId] = uniqTags(storage.projects[projectId] ?? []);
            if (
                (storage.projects[projectId] ?? []).length !==
                result[projectId].length
            ) {
                storage.projects[projectId] = result[projectId];
                changed = true;
            }
        }

        if (changed) {
            this.saveStorage(storage);
        }

        return result;
    }

    getAllTags(projectIds?: string[]): string[] {
        const storage = this.readStorage();
        const ids = projectIds ?? Object.keys(storage.projects);
        const tags = ids.flatMap((id) => storage.projects[id] ?? []);
        return uniqTags(tags);
    }

    addTagToProject(projectId: string, tag: string): string[] {
        const normalized = normalizeTag(tag);
        if (!normalized) {
            return this.readStorage().projects[projectId] ?? [];
        }

        const storage = this.readStorage();
        const currentTags = storage.projects[projectId] ?? [];
        storage.projects[projectId] = uniqTags([...currentTags, normalized]);
        this.saveStorage(storage);
        return storage.projects[projectId];
    }

    removeTagFromProject(projectId: string, tag: string): string[] {
        const normalized = normalizeTag(tag);
        const storage = this.readStorage();
        const currentTags = storage.projects[projectId] ?? [];
        storage.projects[projectId] = uniqTags(
            currentTags.filter(
                (existingTag) =>
                    existingTag.toLocaleLowerCase() !==
                    normalized.toLocaleLowerCase()
            )
        );
        this.saveStorage(storage);
        return storage.projects[projectId];
    }
}
