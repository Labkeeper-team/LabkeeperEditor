type PromiseWithResolvers<T> = {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
};

type PromiseConstructorWithResolvers = PromiseConstructor & {
    withResolvers?: <T>() => PromiseWithResolvers<T>;
};

type ReadableStreamIteratorOptions = {
    preventCancel?: boolean;
};

type ReadableStreamPrototypeWithAsyncIterator = {
    values?: (
        options?: ReadableStreamIteratorOptions
    ) => AsyncIterableIterator<unknown>;
    [Symbol.asyncIterator]?: (
        options?: ReadableStreamIteratorOptions
    ) => AsyncIterableIterator<unknown>;
};

export const ensurePromiseWithResolvers = () => {
    const promiseConstructor = Promise as PromiseConstructorWithResolvers;

    if (typeof promiseConstructor.withResolvers === 'function') {
        return;
    }

    promiseConstructor.withResolvers = <T>() => {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: unknown) => void;

        const promise = new Promise<T>((resolvePromise, rejectPromise) => {
            resolve = resolvePromise;
            reject = rejectPromise;
        });

        return {
            promise,
            resolve,
            reject,
        };
    };
};

export const ensureReadableStreamAsyncIterator = () => {
    if (typeof ReadableStream === 'undefined') {
        return;
    }

    const readableStreamPrototype =
        ReadableStream.prototype as unknown as ReadableStreamPrototypeWithAsyncIterator;

    if (typeof readableStreamPrototype.values !== 'function') {
        readableStreamPrototype.values = function (
            this: ReadableStream<unknown>,
            { preventCancel = false }: ReadableStreamIteratorOptions = {}
        ) {
            const reader = this.getReader();
            const iterator: AsyncIterableIterator<unknown> = {
                async next() {
                    try {
                        const result = await reader.read();
                        if (result.done) {
                            reader.releaseLock();
                        }
                        return result;
                    } catch (error) {
                        reader.releaseLock();
                        throw error;
                    }
                },
                async return(value?: unknown) {
                    if (!preventCancel) {
                        const cancelPromise = reader.cancel(value);
                        reader.releaseLock();
                        await cancelPromise;
                    } else {
                        reader.releaseLock();
                    }

                    return {
                        done: true,
                        value,
                    };
                },
                [Symbol.asyncIterator]() {
                    return this;
                },
            };

            return iterator;
        };
    }

    if (typeof readableStreamPrototype[Symbol.asyncIterator] !== 'function') {
        readableStreamPrototype[Symbol.asyncIterator] =
            readableStreamPrototype.values;
    }
};

ensurePromiseWithResolvers();
ensureReadableStreamAsyncIterator();
