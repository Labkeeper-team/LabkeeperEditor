import axios from 'axios';

jest.mock('../../../constants.ts', () => ({
    URLS: {
        renameFile: '/api/v2/public/project/{id}/file/rename',
    },
}));

import { WebRpi } from '../../../web/server';

jest.mock('axios', () => ({
    __esModule: true,
    default: {
        post: jest.fn(),
    },
}));

describe('WebRpi', () => {
    test('renameFileRequest passes old and new file names as-is', async () => {
        const postMock = axios.post as jest.Mock;
        postMock.mockResolvedValue({
            status: 200,
            data: {},
        });
        const rpi = new WebRpi();

        await rpi.renameFileRequest(
            'note.txt',
            'folder name/<>?.txt',
            'project-id'
        );

        expect(postMock).toHaveBeenCalledWith(
            expect.stringContaining('old=note.txt&new=folder name/<>?.txt')
        );
    });
});
