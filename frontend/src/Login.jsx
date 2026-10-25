import React, { useState } from 'react';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://127.0.0.1:8000';

function Login({ onSwitch, onLoginSuccess }) {
  const [viewMode, setViewMode] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

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

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const response = await axios.post(
          `${API_BASE_URL}/auth/google-login`,
          { credential: credentialResponse.credential },
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
      setError(err.response?.data?.detail || 'Eroare la autentificarea cu Google.');
    } finally {
      setLoading(false);
    }
  };

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
      <div style={{ maxWidth: '400px', width: '90%', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'sans-serif', backgroundColor: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', boxSizing: 'border-box' }}>

        {viewMode === 'login' ? (
            <>
              <h2 style={{ textAlign: 'center', color: '#e63946', fontSize: '20px' }}>Autentificare</h2>

              {success && <p style={{ color: '#2b9348', backgroundColor: '#e3ffe3', padding: '10px', borderRadius: '4px', textAlign: 'center', fontSize: '13px' }}>{success}</p>}
              {error && <p style={{ color: 'red', backgroundColor: '#ffe3e3', padding: '10px', borderRadius: '4px', fontSize: '13px' }}>{error}</p>}

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px', marginTop: '10px', width: '100%', overflow: 'hidden' }}>
                <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Autentificarea cu Google a eșuat.')}
                    useOneTap
                    theme="outline"
                    shape="rectangular"
                    text="continue_with"
                    locale="ro"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', textAlign: 'center', color: '#aaa', margin: '12px 0' }}>
                <div style={{ flex: 1, borderBottom: '1px solid #ddd' }}></div>
                <span style={{ padding: '0 10px', fontSize: '12px' }}>sau cu email</span>
                <div style={{ flex: 1, borderBottom: '1px solid #ddd' }}></div>
              </div>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '12px' }}>
                  <label htmlFor="email-input" style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Email:</label>
                  <input
                      id="email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      disabled={loading}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }}
                  />
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <label htmlFor="password-input" style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Parolă:</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                        id="password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        disabled={loading}
                        style={{ width: '100%', padding: '8px', paddingRight: '40px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#666' }}
                    >
                      {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                      ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginBottom: '12px' }}>
                  <button
                      type="button"
                      onClick={() => { setViewMode('forgot'); setError(''); setSuccess(''); }}
                      style={{ background: 'none', border: 'none', color: '#666', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
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
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                >
                  {loading ? 'Se procesează...' : 'Intră în cont'}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
                Nu ai cont? <button onClick={onSwitch} type="button" style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', fontWeight: 'bold', padding: 0, font: 'inherit' }}>Înregistrează-te</button>
              </p>
            </>
        ) : (
            <>
              <h2 style={{ textAlign: 'center', color: '#e63946', marginBottom: '8px', fontSize: '18px' }}>Resetare Parolă</h2>
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#666', marginBottom: '15px' }}>
                {forgotStep === 1
                    ? 'Introdu adresa de email pentru a primi codul de resetare.'
                    : 'Introdu codul primit pe email și noua parolă.'}
              </p>

              {success && <p style={{ color: '#2b9348', backgroundColor: '#e3ffe3', padding: '8px', borderRadius: '4px', marginBottom: '12px', textAlign: 'center', fontSize: '12px' }}>{success}</p>}

              {forgotStep === 1 ? (
                  <form onSubmit={handleSendForgotCode}>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Email:</label>
                      <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          placeholder="nume@gmail.com"
                          disabled={loading}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }}
                      />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ width: '100%', padding: '9px', backgroundColor: loading ? '#ccc' : '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                    >
                      {loading ? 'Se trimite...' : 'Trimite cod de resetare'}
                    </button>
                  </form>
              ) : (
                  <form onSubmit={handleResetPassword}>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Cod de resetare (6 cifre):</label>
                      <input
                          type="text"
                          maxLength={6}
                          value={forgotCode}
                          onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                          required
                          placeholder="123456"
                          disabled={loading}
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', textAlign: 'center', letterSpacing: '3px', fontWeight: 'bold', fontSize: '14px' }}
                      />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>Parolă nouă:</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            disabled={loading}
                            style={{ width: '100%', padding: '8px', paddingRight: '40px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#666' }}
                        >
                          {showNewPassword ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                          ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                              </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ width: '100%', padding: '9px', backgroundColor: loading ? '#ccc' : '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                    >
                      {loading ? 'Se resetează...' : 'Resetează parola'}
                    </button>
                  </form>
              )}

              {error && (
                  <div style={{ color: '#d90429', backgroundColor: '#ffe3e3', padding: '8px', borderRadius: '4px', fontSize: '13px', marginTop: '10px', textAlign: 'center', border: '1px solid #f5c6cb' }}>
                    {error}
                  </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '15px' }}>
                <button
                    type="button"
                    onClick={() => { setViewMode('login'); setForgotStep(1); setError(''); setSuccess(''); }}
                    style={{ background: 'none', border: 'none', color: '#e63946', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 'bold', fontSize: '13px' }}
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