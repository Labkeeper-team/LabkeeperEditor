const DEFAULT_API_VERSION: BuildInfo = {
    major: 2,
    minor: '',
};
const PREFIX = '{';

export const BUILD_INFO = parseVersionEnv(__MODE__ as string);

export interface BuildInfo {
    major: number;
    minor: string;
}

function parseVersionEnv(env: string): BuildInfo {
    if (env && env.startsWith(PREFIX)) {
        return JSON.parse(env);
    }
    return DEFAULT_API_VERSION;
}
