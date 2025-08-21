import { Provider as StoreProvider } from 'react-redux';
import * as Sentry from '@sentry/react';
import { ToastContainer } from 'react-toastify';
import { PersistGate } from 'redux-persist/integration/react';
import './App.scss';
import { persist, store } from '../viewModel/store';
import { RouterProvider } from 'react-router-dom';
import { appRouter } from './routing';
import ScaleWrapper from './components/scaleWrapper';

function App() {
    return (
        <Sentry.ErrorBoundary
            showDialog
            fallback={({ resetError }) => (
                <div
                    style={{
                        padding: 24,
                        backgroundColor: '#fff',
                        color: '#000',
                    }}
                >
                    <h2>Something went wrong</h2>
                    <p>
                        The error has been reported. Please try reloading the
                        page.
                    </p>
                    <button
                        onClick={() => {
                            resetError();
                            location.reload();
                        }}
                    >
                        Reload
                    </button>
                </div>
            )}
        >
            <ScaleWrapper minWidth={1024}>
                <StoreProvider store={store}>
                    <PersistGate loading={undefined} persistor={persist}>
                        <RouterProvider router={appRouter} />
                    </PersistGate>
                    <ToastContainer />
                </StoreProvider>
            </ScaleWrapper>
        </Sentry.ErrorBoundary>
    );
}

export default App;
