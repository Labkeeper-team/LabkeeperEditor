import { memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Hunk } from '../../../../../../../model/domain.ts';
import { controller } from '../../../../../../../main.tsx';
import { AppDispatch, StorageState } from '../../../../../../store';
import { useDictionary } from '../../../../../../store/selectors/translations';
import './style.scss';

/**
 * Сегменты, которые агент удалил целиком, на их прежнем месте в списке.
 * В программе их уже нет, поэтому это не редактор, а карточка с текстом и
 * кнопками, как у добавленного сегмента: минус вместо плюса.
 *
 * Каждая карточка идёт парой с отступом: соседние сегменты красят поле
 * номеров строк через nth-child, и одиночный элемент сбил бы им чередование
 */
export const DeletedSegments = memo(
    ({ hunks, atEnd = false }: { hunks?: Hunk[]; atEnd?: boolean }) => {
        if (!hunks?.length) {
            return null;
        }
        return (
            <>
                {/* после последнего сегмента разделителя нет, и отступ встаёт перед карточкой */}
                {hunks.map((hunk) => (
                    <DeletedSegmentPair
                        key={hunk.id}
                        hunk={hunk}
                        gapFirst={atEnd}
                    />
                ))}
            </>
        );
    }
);

const DeletedSegmentPair = ({
    hunk,
    gapFirst = false,
}: {
    hunk: Hunk;
    gapFirst?: boolean;
}) => {
    const gap = <div className="deleted-segment-gap" aria-hidden="true" />;
    return (
        <>
            {gapFirst && gap}
            <DeletedSegment hunk={hunk} />
            {!gapFirst && gap}
        </>
    );
};

const DeletedSegment = ({ hunk }: { hunk: Hunk }) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const pending = useSelector((state: StorageState) =>
        state.ide.pendingHunkIds.includes(hunk.id)
    );
    const hunkIds = [hunk.id];

    return (
        <div className="deleted-segment" data-testid="deleted-segment">
            <div
                className="segment-hunk-new-badge deleted-segment__badge"
                aria-label={dictionary.hunks.deleted}
            >
                <MinusIcon />
            </div>
            <div className="deleted-segment__body">
                <pre className="deleted-segment__text">{hunk.text ?? ''}</pre>
            </div>
            <div className="segment-hunk-actions">
                <button
                    type="button"
                    className="segment-hunk-btn segment-hunk-btn--accept"
                    disabled={pending}
                    onClick={() =>
                        dispatch(controller.onHunkAcceptRequest({ hunkIds }))
                    }
                >
                    {pending ? (
                        <span className="segment-hunk-btn__spinner segment-hunk-btn__spinner--accept" />
                    ) : (
                        dictionary.hunks.accept
                    )}
                </button>
                {isAuthenticated ? (
                    <button
                        type="button"
                        className="segment-hunk-btn segment-hunk-btn--revert"
                        disabled={pending}
                        onClick={() =>
                            dispatch(
                                controller.onHunkRevertRequest({ hunkIds })
                            )
                        }
                    >
                        {pending ? (
                            <span className="segment-hunk-btn__spinner segment-hunk-btn__spinner--revert" />
                        ) : (
                            dictionary.hunks.revert
                        )}
                    </button>
                ) : null}
            </div>
        </div>
    );
};

const MinusIcon = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
    >
        <path
            d="M4.6 9.2h10.8c.33 0 .6.27.6.6v.4c0 .33-.27.6-.6.6H4.6a.6.6 0 0 1-.6-.6v-.4c0-.33.27-.6.6-.6z"
            fill="currentColor"
        />
    </svg>
);
