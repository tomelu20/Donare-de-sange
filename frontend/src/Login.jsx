import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://127.0.0.1:8000';

function Login({ onSwitch, onLoginSuccess }) {
  const [viewMode, setViewMode] = useState('login'); // 'login' sau 'forgot'

  // State-uri Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // State-uri Forgot Password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1: Trimite email, 2: Introdu cod și parolă nouă
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          email: email.trim(),
          password: password
        },
        { withCredentials: true }
      );
      
      sessionStorage.setItem('user_session', JSON.stringify(response.data.user));
      
      if (response.data.access_token) {
        sessionStorage.setItem('access_token', response.data.access_token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      }
      
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Prea multe încercări. Vă rugăm să așteptați câteva minute.');
      } else {
        setError(err.response?.data?.detail || 'A apărut o eroare la logare.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Trimitere cod resetare parolă
  const handleSendForgotCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!forgotEmail || !forgotEmail.includes('@')) {
      setError('Te rog introdu o adresă de email validă.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email: forgotEmail.trim() });
      setForgotStep(2);
      setSuccess('Dacă adresa de email există în sistem, un cod de resetare a fost trimis pe email.');
    } catch (err) {
      setError(err.response?.data?.detail || 'A apărut o eroare. Încearcă din nou.');
    } finally {
      setLoading(false);
    }
  };

  // Trimitere parolă nouă
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!forgotCode || forgotCode.length < 6) {
      setError('Introdu codul complet din 6 cifre primit pe email.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Parola nouă trebuie să conțină cel puțin 8 caractere.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        email: forgotEmail.trim(),
        code: forgotCode.trim(),
        new_password: newPassword
      });

      setSuccess('Parola a fost resetată cu succes! Te poți conecta acum.');
      setTimeout(() => {
        setViewMode('login');
        setForgotStep(1);
        setForgotEmail('');
        setForgotCode('');
        setNewPassword('');
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Codul introdus este incorect sau a expirat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '80px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'sans-serif', backgroundColor: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
      
      {viewMode === 'login' ? (
        <>
          <h2 style={{ textAlign: 'center', color: '#e63946' }}>Autentificare</h2>
          
          {success && <p style={{ color: '#2b9348', backgroundColor: '#e3ffe3', padding: '10px', borderRadius: '4px', textAlign: 'center' }}>{success}</p>}
          {error && <p style={{ color: 'red', backgroundColor: '#ffe3e3', padding: '10px', borderRadius: '4px' }}>{error}</p>}
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="email-input" style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
              <input 
                id="email-input"
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                autoComplete="email"
                disabled={loading}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="password-input" style={{ display: 'block', marginBottom: '5px' }}>Parolă:</label>
              <input 
                id="password-input"
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                autoComplete="current-password"
                disabled={loading}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>

            {/* Butonul „Ai uitat parola?” poziționat fix sub câmpul de parolă */}
            <div style={{ textAlign: 'right', marginBottom: '15px' }}>
              <button 
                type="button" 
                onClick={() => { setViewMode('forgot'); setError(''); setSuccess(''); }} 
                style={{ background: 'none', border: 'none', color: '#666', fontSize: '13px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >
                Ai uitat parola?
              </button>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                width: '100%', 
                padding: '10px', 
                backgroundColor: loading ? '#ccc' : '#e63946', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                fontSize: '16px' 
              }}
            >
              {loading ? 'Se procesează...' : 'Intră în cont'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '14px' }}>
            Nu ai cont? <button onClick={onSwitch} type="button" style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', fontWeight: 'bold', padding: 0, font: 'inherit' }}>Înregistrează-te</button>
          </p>
        </>
      ) : (
        /* Ecranul de Forgot Password / Resetare */
        <>
          <h2 style={{ textAlign: 'center', color: '#e63946', marginBottom: '10px' }}>Resetare Parolă</h2>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#666', marginBottom: '20px' }}>
            {forgotStep === 1 
              ? 'Introdu adresa de email pentru a primi codul de resetare.' 
              : 'Introdu codul primit pe email și noua parolă.'}
          </p>

          {success && <p style={{ color: '#2b9348', backgroundColor: '#e3ffe3', padding: '10px', borderRadius: '4px', marginBottom: '15px', textAlign: 'center' }}>{success}</p>}

          {forgotStep === 1 ? (
            <form onSubmit={handleSendForgotCode}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
                <input 
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  placeholder="nume@gmail.com"
                  disabled={loading}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                style={{ width: '100%', padding: '10px', backgroundColor: loading ? '#ccc' : '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px' }}
              >
                {loading ? 'Se trimite...' : 'Trimite cod de resetare'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Cod de resetare (6 cifre):</label>
                <input 
                  type="text"
                  maxLength={6}
                  value={forgotCode}
                  onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="123456"
                  disabled={loading}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', textAlign: 'center', letterSpacing: '4px', fontWeight: 'bold' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Parolă nouă:</label>
                <input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  disabled={loading}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                style={{ width: '100%', padding: '10px', backgroundColor: loading ? '#ccc' : '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px' }}
              >
                {loading ? 'Se resetează...' : 'Resetează parola'}
              </button>
            </form>
          )}

          {error && (
            <div style={{ color: '#d90429', backgroundColor: '#ffe3e3', padding: '10px', borderRadius: '4px', fontSize: '14px', marginTop: '12px', textAlign: 'center', border: '1px solid #f5c6cb' }}>
              {error}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button 
              type="button" 
              onClick={() => { setViewMode('login'); setForgotStep(1); setError(''); setSuccess(''); }} 
              style={{ background: 'none', border: 'none', color: '#e63946', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 'bold', fontSize: '14px' }}
            >
              ← Înapoi la Autentificare
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Login;