import React, { useState } from 'react';
import axios from 'axios';

// Compatibilitate sigură cu Vite / Create-React-App
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://127.0.0.1:8000';

function Register({ onSwitch, onRegisterSuccess }) {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailCode, setEmailCode] = useState(''); 
  
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false); 
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 1. Criterii de securitate pentru parolă
  const passwordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  // 2. Format telefon românesc exact 10 caractere (07XXXXXXXX)
  const isPhoneValid = /^07\d{8}$/.test(phone);

  // Sanitizare Nume / Prenume (doar litere, spațiu și cratimă)
  const handleNameInput = (value, setter) => {
    const lettersOnly = value.replace(/[^a-zA-ZăîâșțĂÎÂȘȚ\s\-]/g, '');
    setter(lettersOnly);
  };

  // Sanitizare Telefon (doar cifre, maxim 10)
  const handlePhoneInput = (value) => {
    const numbersOnly = value.replace(/\D/g, '').slice(0, 10);
    setPhone(numbersOnly);
  };

  // Trimiterea codului pe email
  const handleSendEmailCode = async () => {
    setError('');
    setSuccess('');
    if (!email || !email.includes('@')) {
      setError('Te rog introdu o adresă de email validă mai întâi.');
      return;
    }

    setIsSendingCode(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/send-email-code?email=${encodeURIComponent(email.trim())}`);
      setIsCodeSent(true);
      setSuccess('Codul de verificare a fost trimis pe email!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Eroare la trimiterea email-ului.');
    } finally {
      setIsSendingCode(false);
    }
  };

  // Verificarea codului OTP
  const handleVerifyCode = async () => {
    setError('');
    setSuccess('');
    if (!emailCode || emailCode.length < 6) {
      setError('Te rog introdu codul complet din 6 cifre primit pe email.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      await axios.post(
        `${API_BASE_URL}/auth/verify-email-code?email=${encodeURIComponent(email.trim())}&email_code=${encodeURIComponent(emailCode.trim())}`
      );
      setIsVerified(true);
      setSuccess('Email verificat cu succes! Puteți continua completarea formularului.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Codul introdus este incorect sau a expirat.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Creare cont
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isPhoneValid) {
      setError('Numărul de telefon trebuie să aibă exact 10 cifre și să înceapă cu 07 (ex: 07XXXXXXXX).');
      return;
    }

    if (!isPasswordValid) {
      setError('Parola nu respectă toate cerințele de securitate.');
      return;
    }

    if (!isVerified) {
      setError('Trebuie să vă verificați adresa de email înainte de a crea contul.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/register`,
        {
          name: name.trim(),
          surname: surname.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password: password,
          email_code: emailCode.trim()
        },
        { withCredentials: true }
      );
      
      sessionStorage.setItem('user_session', JSON.stringify(response.data));
      setSuccess('Contul a fost creat cu succes! Te redirecționăm direct în aplicație...');
      
      setName('');
      setSurname('');
      setPhone('');
      setEmail('');
      setPassword('');
      setEmailCode('');
      setIsCodeSent(false);
      setIsVerified(false);

      setTimeout(() => {
        if (onRegisterSuccess) {
          onRegisterSuccess();
        } else if (onSwitch) {
          onSwitch();
        }
      }, 1500);

    } catch (err) {
      setError(err.response?.data?.detail || 'A apărut o eroare la înregistrare.');
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = !isVerified || !isPhoneValid || !isPasswordValid || isLoading;

  return (
    <div style={{ maxWidth: '420px', margin: '40px auto', padding: '24px', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'sans-serif', backgroundColor: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
      <h2 style={{ textAlign: 'center', color: '#e63946', marginBottom: '20px' }}>Înregistrare Cont Nou</h2>
      
      {error && <p style={{ color: '#d90429', backgroundColor: '#ffe3e3', padding: '10px', borderRadius: '4px', fontSize: '14px' }}>{error}</p>}
      {success && <p style={{ color: '#2b9348', backgroundColor: '#e3ffe3', padding: '10px', borderRadius: '4px', fontSize: '14px' }}>{success}</p>}

      <form onSubmit={handleRegister}>
        
        {/* 1. NUME */}
        <div style={{ marginBottom: '14px' }}>
          <label htmlFor="reg-name" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nume:</label>
          <input 
            id="reg-name"
            type="text" 
            value={name} 
            onChange={(e) => handleNameInput(e.target.value, setName)} 
            required 
            placeholder="ex: Popescu"
            disabled={isLoading}
            style={{ width: '100%', padding: '9px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>

        {/* 2. PRENUME */}
        <div style={{ marginBottom: '14px' }}>
          <label htmlFor="reg-surname" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Prenume:</label>
          <input 
            id="reg-surname"
            type="text" 
            value={surname} 
            onChange={(e) => handleNameInput(e.target.value, setSurname)} 
            required 
            placeholder="ex: Andrei"
            disabled={isLoading}
            style={{ width: '100%', padding: '9px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>

        {/* 3. TELEFON */}
        <div style={{ marginBottom: '14px' }}>
          <label htmlFor="reg-phone" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Telefon:</label>
          <input 
            id="reg-phone"
            type="tel" 
            value={phone} 
            onChange={(e) => handlePhoneInput(e.target.value)} 
            required 
            maxLength={10}
            placeholder="07XXXXXXXX"
            disabled={isLoading}
            style={{ 
              width: '100%', 
              padding: '9px', 
              borderRadius: '4px', 
              border: `1px solid ${phone && !isPhoneValid ? '#e63946' : '#ccc'}`, 
              boxSizing: 'border-box' 
            }}
          />
          {phone && !isPhoneValid && (
            <span style={{ fontSize: '12px', color: '#e63946', marginTop: '3px', display: 'block' }}>
              Format invalid. Trebuie să aibă exact 10 cifre și să înceapă cu 07 ({phone.length}/10).
            </span>
          )}
        </div>

        {/* 4. EMAIL + BUTON TRIMITE COD */}
        <div style={{ marginBottom: '14px' }}>
          <label htmlFor="reg-email" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email: (Adresa de email trebuie verificată)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              id="reg-email"
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              disabled={isVerified || isLoading} 
              placeholder="nume@gmail.com"
              style={{ flex: 1, padding: '9px', borderRadius: '4px', border: isVerified ? '2px solid green' : '1px solid #ccc', boxSizing: 'border-box', backgroundColor: isVerified ? '#f0fff0' : 'white' }}
            />
            <button 
              type="button" 
              onClick={handleSendEmailCode} 
              disabled={isVerified || isSendingCode || isLoading}
              style={{ 
                padding: '9px 14px', 
                backgroundColor: isVerified ? '#999' : '#333', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: (isVerified || isSendingCode) ? 'default' : 'pointer', 
                fontSize: '13px', 
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}
            >
              {isVerified ? 'Verificat ✓' : isSendingCode ? 'Se trimite...' : isCodeSent ? 'Retrimite' : 'Trimite cod'}
            </button>
          </div>
        </div>

        {/* BLOC VERIFICARE COD EMAIL */}
        {isCodeSent && (
          <div style={{ marginBottom: '14px', backgroundColor: isVerified ? '#f0fff0' : '#f9f9f9', padding: '10px', borderRadius: '4px', border: isVerified ? '1px solid green' : '1px dashed #e63946' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: isVerified ? 'green' : '#e63946' }}>
              {isVerified ? '✓ Email Verificat' : 'Cod Verificare Email (6 cifre):'}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                maxLength={6}
                value={emailCode} 
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))} 
                required 
                disabled={isVerified || isLoading}
                placeholder="123456"
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', textAlign: 'center', letterSpacing: '4px', fontWeight: 'bold' }}
              />
              {!isVerified && (
                <button 
                  type="button" 
                  onClick={handleVerifyCode} 
                  disabled={isVerifyingCode || isLoading}
                  style={{ padding: '8px 14px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: isVerifyingCode ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                >
                  {isVerifyingCode ? 'Se verifică...' : 'Verifică'}
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* 5. PAROLĂ CU GHID VIZUAL */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="reg-password" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Parolă:</label>
          <input 
            id="reg-password"
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            autoComplete="new-password"
            disabled={isLoading}
            placeholder="••••••••"
            style={{ width: '100%', padding: '9px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />

          <div style={{ marginTop: '8px', fontSize: '12px', backgroundColor: '#f8f9fa', padding: '8px', borderRadius: '4px', border: '1px solid #eee' }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#444' }}>Cerințe parolă:</p>
            <div style={{ color: passwordCriteria.length ? '#2b9348' : '#888' }}>
              {passwordCriteria.length ? '✓' : '•'} Minim 8 caractere
            </div>
            <div style={{ color: passwordCriteria.uppercase ? '#2b9348' : '#888' }}>
              {passwordCriteria.uppercase ? '✓' : '•'} Cel puțin o majusculă (A-Z)
            </div>
            <div style={{ color: passwordCriteria.number ? '#2b9348' : '#888' }}>
              {passwordCriteria.number ? '✓' : '•'} Cel puțin o cifră (0-9)
            </div>
            <div style={{ color: passwordCriteria.special ? '#2b9348' : '#888' }}>
              {passwordCriteria.special ? '✓' : '•'} Cel puțin un caracter special (!@#$%^&* etc.)
            </div>
          </div>
        </div>
        
        <button 
          type="submit" 
          disabled={isSubmitDisabled} 
          style={{ 
            width: '100%', 
            padding: '12px', 
            backgroundColor: isSubmitDisabled ? '#ccc' : '#e63946', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: isSubmitDisabled ? 'not-allowed' : 'pointer', 
            fontSize: '16px', 
            fontWeight: 'bold',
            transition: 'background-color 0.2s ease'
          }}
        >
          {isLoading ? 'Se creează contul...' : 'Creează cont'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '14px' }}>
        Ai deja un cont?{' '}
        <button type="button" onClick={onSwitch} style={{ background: 'none', border: 'none', color: '#e63946', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 'bold' }}>
          Conectează-te aici
        </button>
      </p>
    </div>
  );
}

export default Register;