import React, { useState } from 'react';
import axios from 'axios';

function WaitlistModal({ campaign, onClose, onRefresh }) {
  const savedUser = sessionStorage.getItem('user_session');
  const user = savedUser ? JSON.parse(savedUser) : null;

  const [preferredTime, setPreferredTime] = useState('');
  const [travelTime, setTravelTime] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!campaign || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // user_id a fost scos din payload, fiind extras în siguranță pe backend din token-ul JWT
      await axios.post('http://127.0.0.1:8000/waitlist/', {
        campaign_id: campaign.id,
        name: user.name,
        surname: user.surname,
        phone: user.phone,
        email: user.email,
        preferred_time_range: preferredTime,
        travel_time_minutes: parseInt(travelTime)
      });

      setSuccess('Te-ai înscris cu succes în lista de așteptare!');
      if (onRefresh) onRefresh();
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Eroare la înscrierea în lista de așteptare.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', maxWidth: '450px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', fontFamily: 'sans-serif' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#e63946' }}>Înscriere Waitlist</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>&times;</button>
        </div>

        {error && <p style={{ color: 'red', backgroundColor: '#ffe3e3', padding: '10px', borderRadius: '4px', fontSize: '14px' }}>{error}</p>}
        {success && <p style={{ color: 'green', backgroundColor: '#e3ffe3', padding: '10px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>{success}</p>}

        {!success && (
          <form onSubmit={handleSubmit}>
            <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#555', lineHeight: '1.4' }}>
              Dacă nu găsești un interval disponibil sau potrivit pentru campania de la <strong>{campaign.location_name}</strong>, completează opțiunile de mai jos și te vom contacta dacă un loc se eliberează.
            </p>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>Ziua si intervalul orar preferat:</label>
              <input 
                type="text" 
                value={preferredTime} 
                onChange={(e) => setPreferredTime(e.target.value)} 
                required 
                placeholder="Ex: 22 Aprilie 09 - 11 sau Oricând" 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>Timp estimat de deplasare (minute):</label>
              <select 
                value={travelTime} 
                onChange={(e) => setTravelTime(e.target.value)} 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              >
                <option value="10">10 minute</option>
                <option value="20">20 minute</option>
                <option value="30">30 minute</option>
                <option value="45">45 minute</option>
                <option value="60">O oră</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '15px' }}>
              <button 
                type="button" 
                onClick={onClose} 
                style={{ padding: '8px 15px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
              >
                Renunță
              </button>
              <button 
                type="submit" 
                disabled={loading}
                style={{ padding: '8px 15px', backgroundColor: '#2b2d42', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
              >
                {loading ? 'Se trimite...' : 'Înscrie-mă'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default WaitlistModal;