import { Provider as StoreProvider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import { PersistGate } from 'redux-persist/integration/react';
import './App.scss';
import { persist, store } from './store';
import { RouterProvider } from 'react-router-dom';
import { appRouter } from './routing';

function App() {
    return (
        <StoreProvider store={store}>
            <PersistGate loading={undefined} persistor={persist}>
                <RouterProvider router={appRouter} />
            </PersistGate>
            <ToastContainer />
        </StoreProvider>
    );
}

export default App;
