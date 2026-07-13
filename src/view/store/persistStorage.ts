import type { Storage } from 'redux-persist';

const persistStorage: Storage = {
    getItem(key) {
        return Promise.resolve(window.localStorage.getItem(key));
    },
    setItem(key, value) {
        return Promise.resolve(window.localStorage.setItem(key, value));
    },
    removeItem(key) {
        return Promise.resolve(window.localStorage.removeItem(key));
    },
};

export default persistStorage;
