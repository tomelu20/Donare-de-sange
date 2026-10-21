import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Înlocuiește cu Google Client ID-ul tău din Google Cloud Console
const GOOGLE_CLIENT_ID = "TĂU_CLIENT_ID_DIN_GOOGLE_CONSOLE.apps.googleusercontent.com";

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <App />
        </GoogleOAuthProvider>
    </StrictMode>,
)