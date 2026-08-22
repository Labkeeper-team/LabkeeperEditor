import { Program } from '../../../model/domain.ts';
import { mockContext } from '../common.ts';
import { SegmentsViewportAnchor } from '../../../viewModel/repository';

function programOf(texts: string[]): Program {
    return {
        segments: texts.map((text) => ({
            type: 'md',
            parameters: { visible: true },
            text,
        })),
        parameters: { roundStrategy: 'noRound' },
    };
}

function setup(texts: string[], anchor: SegmentsViewportAnchor | null = null) {
    const context = mockContext();
    context.programService.setNewProgram(programOf(texts));
    context.repository.ideViewModelRepository.segmentsViewportAnchor = () =>
        anchor;
    return context;
}

test('search-submit-with-new-query-navigates-to-first-match-after-anchor', () => {
    const { projectPageService, repository } = setup(
        ['foo', 'bar foo', 'foo'],
        { segmentIndex: 1, line: 1 }
    );
    repository.ideViewModelRepository.setSearchInput('foo');

    projectPageService.onSearchSubmit();

    expect(repository.ideViewModelRepository.search()).toBe('foo');
    expect(repository.ideViewModelRepository.searchCurrentMatch()).toEqual({
        segmentIndex: 1,
        from: 4,
        to: 7,
    });
    expect(repository.ideViewModelRepository.editorNavigationTarget()).toEqual({
        segmentIndex: 1,
        line: 1,
        focus: false,
    });
    expect(repository.ideViewModelRepository.searchNoMatch()).toBe(false);
});

test('search-submit-does-not-change-active-segment', () => {
    const { projectPageService, repository } = setup(['foo', 'foo']);
    repository.ideViewModelRepository.setActiveSegmentIndex(-1);
    repository.ideViewModelRepository.setSearchInput('foo');

    projectPageService.onSearchSubmit();

    expect(repository.ideViewModelRepository.activeSegmentIndex()).toBe(-1);
});

test('repeated-search-submit-moves-to-next-match-ignoring-anchor', () => {
    const { projectPageService, repository } = setup(['foo', 'foo', 'foo'], {
        segmentIndex: 0,
        line: 1,
    });
    repository.ideViewModelRepository.setSearchInput('foo');

    projectPageService.onSearchSubmit();
    projectPageService.onSearchSubmit();

    expect(
        repository.ideViewModelRepository.searchCurrentMatch()?.segmentIndex
    ).toBe(1);
});

test('search-submit-wraps-from-last-match-to-first', () => {
    const { projectPageService, repository } = setup(['foo', 'foo']);
    repository.ideViewModelRepository.setSearchInput('foo');

    projectPageService.onSearchSubmit();
    projectPageService.onSearchSubmit();
    projectPageService.onSearchSubmit();

    expect(
        repository.ideViewModelRepository.searchCurrentMatch()?.segmentIndex
    ).toBe(0);
});

test('search-submit-after-input-change-restarts-from-anchor', () => {
    const { projectPageService, repository } = setup(['foo', 'foo', 'foo'], {
        segmentIndex: 2,
        line: 1,
    });
    repository.ideViewModelRepository.setSearchInput('foo');

    projectPageService.onSearchSubmit();
    expect(
        repository.ideViewModelRepository.searchCurrentMatch()?.segmentIndex
    ).toBe(2);

    // поменяли текст и вернули прежний: следующий Enter снова идёт от якоря
    projectPageService.onSearchInputChanged('fo');
    projectPageService.onSearchInputChanged('foo');
    projectPageService.onSearchSubmit();

    expect(
        repository.ideViewModelRepository.searchCurrentMatch()?.segmentIndex
    ).toBe(2);
});

test('search-submit-with-empty-input-does-nothing', () => {
    const { projectPageService, repository } = setup(['foo']);
    repository.ideViewModelRepository.setSearchInput('');

    projectPageService.onSearchSubmit();

    expect(repository.ideViewModelRepository.search()).toBeUndefined();
    expect(repository.ideViewModelRepository.searchNoMatch()).toBe(false);
    expect(
        repository.ideViewModelRepository.editorNavigationTarget()
    ).toBeNull();
});

test('search-submit-without-matches-marks-field-and-skips-navigation', () => {
    const { projectPageService, repository } = setup(['foo']);
    repository.ideViewModelRepository.setSearchInput('zzz');

    projectPageService.onSearchSubmit();

    expect(repository.ideViewModelRepository.searchNoMatch()).toBe(true);
    expect(repository.ideViewModelRepository.searchCurrentMatch()).toBeNull();
    expect(
        repository.ideViewModelRepository.editorNavigationTarget()
    ).toBeNull();
});

test('search-is-case-sensitive', () => {
    const { projectPageService, repository } = setup(['Foo']);
    repository.ideViewModelRepository.setSearchInput('foo');

    projectPageService.onSearchSubmit();

    expect(repository.ideViewModelRepository.searchNoMatch()).toBe(true);
});

test('search-input-change-clears-no-match-and-current-match', () => {
    const { projectPageService, repository } = setup(['foo']);
    repository.ideViewModelRepository.setSearchInput('zzz');
    projectPageService.onSearchSubmit();

    projectPageService.onSearchInputChanged('z');

    expect(repository.ideViewModelRepository.searchInput()).toBe('z');
    expect(repository.ideViewModelRepository.searchNoMatch()).toBe(false);
    expect(repository.ideViewModelRepository.searchCurrentMatch()).toBeNull();
});

test('search-input-change-does-not-touch-committed-query', () => {
    const { projectPageService, repository } = setup(['foo']);
    repository.ideViewModelRepository.setSearchInput('foo');
    projectPageService.onSearchSubmit();

    projectPageService.onSearchInputChanged('fo');

    expect(repository.ideViewModelRepository.search()).toBe('foo');
});

test('search-cross-click-clears-everything-and-closes-plate', () => {
    const { projectPageService, repository } = setup(['foo']);
    repository.settingsViewModelRepository.setShowSearch(true);
    repository.ideViewModelRepository.setSearchInput('foo');
    projectPageService.onSearchSubmit();

    projectPageService.onSearchIconPress();

    expect(repository.settingsViewModelRepository.showSearch()).toBe(false);
    expect(repository.ideViewModelRepository.search()).toBe('');
    expect(repository.ideViewModelRepository.searchInput()).toBe('');
    expect(repository.ideViewModelRepository.searchNoMatch()).toBe(false);
    expect(repository.ideViewModelRepository.searchCurrentMatch()).toBeNull();
});

test('esc-closes-search-first-and-keeps-problem-viewer-open', () => {
    const { projectPageService, repository } = setup(['foo']);
    repository.settingsViewModelRepository.setShowSearch(true);
    repository.settingsViewModelRepository.setExpandProblemViewer(true);
    repository.ideViewModelRepository.setSearchInput('foo');
    projectPageService.onSearchSubmit();

    projectPageService.onProjectPageEscButtonPressed();

    expect(repository.settingsViewModelRepository.showSearch()).toBe(false);
    expect(repository.ideViewModelRepository.searchCurrentMatch()).toBeNull();
    expect(repository.settingsViewModelRepository.expandProblemViewer()).toBe(
        true
    );
});

test('esc-without-search-falls-through-to-problem-viewer', () => {
    const { projectPageService, repository } = setup(['foo']);
    repository.settingsViewModelRepository.setShowSearch(false);
    repository.settingsViewModelRepository.setExpandProblemViewer(true);

    projectPageService.onProjectPageEscButtonPressed();

    expect(repository.settingsViewModelRepository.expandProblemViewer()).toBe(
        false
    );
});
