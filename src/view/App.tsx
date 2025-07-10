import { Provider as StoreProvider } from 'react-redux';
import { ToastContainer } from 'react-toastify';
import { PersistGate } from 'redux-persist/integration/react';
import './App.scss';
import { persist, store } from '../viewModel/store';
import { RouterProvider } from 'react-router-dom';
import { appRouter } from './routing';
import ScaleWrapper from './components/scaleWrapper';

function App() {
    return (
        <ScaleWrapper minWidth={1024}>
        <StoreProvider store={store}>
            <PersistGate loading={undefined} persistor={persist}>
                <RouterProvider router={appRouter} />
            </PersistGate>
            <ToastContainer />
        </StoreProvider>
        </ScaleWrapper>
    );
}

export default App;
