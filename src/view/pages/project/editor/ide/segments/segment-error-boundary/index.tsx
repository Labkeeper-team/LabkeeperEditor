import { Component, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { useDictionary } from '../../../../../../store/selectors/translations.ts';
import './style.scss';

/** Столько сбоев за окно граница лечит пересозданием сегмента, дальше заглушка */
export const MAX_SEGMENT_RECOVERIES = 3;
/** Сбои старше окна не копятся: редкий сбой за долгую сессию лечится каждый раз */
export const SEGMENT_FAILURE_WINDOW_MS = 30_000;

type BoundaryState = {
    failed: boolean;
    gaveUp: boolean;
};

/**
 * Сбой одного сегмента не закрывает страницу проекта.
 *
 * GH-134: на проде редактор сегмента упал с React #185 прямо при создании
 * CodeMirror, ошибку поймала граница роутера, и вместо проекта открылась
 * страница ошибки. Теперь её ловит граница сегмента и создаёт сегмент заново:
 * текст лежит в сторе, поэтому ничего не теряется. В Bugsink ошибка уходит со
 * стеком компонентов из onCaughtError корня, сама граница ничего не шлёт
 */
export class SegmentErrorBoundary extends Component<
    { children: ReactNode },
    BoundaryState
> {
    state: BoundaryState = { failed: false, gaveUp: false };

    private failures: number[] = [];

    static getDerivedStateFromError(): Partial<BoundaryState> {
        return { failed: true };
    }

    // ошибка рендера при первом показе приходит в componentDidMount, ошибка эффекта в componentDidUpdate
    componentDidMount() {
        this.recover();
    }

    componentDidUpdate() {
        this.recover();
    }

    private recover() {
        if (!this.state.failed) {
            return;
        }
        const now = Date.now();
        this.failures = [
            ...this.failures.filter(
                (at) => now - at < SEGMENT_FAILURE_WINDOW_MS
            ),
            now,
        ];
        // пустой рендер между сбоем и этим вызовом уже размонтировал сегмент, следующий создаст его заново
        this.setState({
            failed: false,
            gaveUp: this.failures.length > MAX_SEGMENT_RECOVERIES,
        });
    }

    private retry = () => {
        this.failures = [];
        this.setState({ gaveUp: false });
    };

    render() {
        if (this.state.failed) {
            return null;
        }
        if (this.state.gaveUp) {
            return <SegmentErrorCard onRetry={this.retry} />;
        }
        return this.props.children;
    }
}

const SegmentErrorCard = ({ onRetry }: { onRetry: () => void }) => {
    const dictionary = useSelector(useDictionary);
    return (
        <div className="segment-error-card" role="alert">
            <span>{dictionary.segment_error.message}</span>
            <button
                type="button"
                className="segment-error-card__retry"
                onClick={onRetry}
            >
                {dictionary.segment_error.retry}
            </button>
        </div>
    );
};
