import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initializeApplication } from './composition-root.js';
import './stylesheet/main.css';

/** Reactのマウント後に既存のPresentation Controllerを初期化する。 */
function VinylApplication() {
    useEffect(() => {
        initializeApplication();
    }, []);

    return <App />;
}

// HTML上のReactルートへアプリケーションを描画する。
createRoot(document.getElementById('root')).render(<VinylApplication />);
