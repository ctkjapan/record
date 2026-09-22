import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initializeApplication } from './composition-root.js';
import './stylesheet/main.css';

function VinylApplication() {
    useEffect(() => {
        initializeApplication();
    }, []);

    return <App />;
}

createRoot(document.getElementById('root')).render(<VinylApplication />);
