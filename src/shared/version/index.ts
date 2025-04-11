export const BUILD_INFO = __BUILD_INFO__ as unknown as BuildInfo;

export interface BuildInfo {
    major: string;
    minor: string;
}
