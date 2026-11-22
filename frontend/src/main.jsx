import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GOOGLE_CLIENT_ID } from './apiConfig'

axios.defaults.withCredentials = true;
sessionStorage.removeItem('access_token');

const app = GOOGLE_CLIENT_ID
    ? <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}><App /></GoogleOAuthProvider>
    : <App />;

createRoot(document.getElementById('root')).render(
    <StrictMode>
        {app}
    </StrictMode>,
)