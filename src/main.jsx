import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { FirebaseProvider } from './hooks/useFirebaseHook'; // ✅ Import the provider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FirebaseProvider> {/* ✅ Wrap App with provider */}
      <App />
    </FirebaseProvider>
  </React.StrictMode>
);