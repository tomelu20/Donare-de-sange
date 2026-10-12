import React, { useState } from 'react';
import axios from 'axios';

function ProfileModal({ user, myAppointments, onClose, onUserUpdated }) {
  const [name, setName] = useState(user.name || '');
  const [surname, setSurname] = useState(user.surname || '');
  const [phone, setPhone] = useState(user.phone || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtrăm strict programările care aparțin utilizatorului curent (după nume și prenume)
  const personalAppointments = myAppointments 
    ? myAppointments.filter(app => {
        const matchesUser = 
          (app.donor_name?.toLowerCase() === user.name?.toLowerCase() && 
           app.donor_surname?.toLowerCase() === user.surname?.toLowerCase()) ||
          (app.user_id && user.id && app.user_id === user.id);
        return matchesUser;
      })
    : [];

  // CALCULĂM NUMĂRUL DE DONĂRI REALE (DOAR PREZENT ✓) din programările personale
  const attendedCount = personalAppointments.filter(app => app.status === 'attended').length;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.put(`http://127.0.0.1:8000/auth/users/${user.id}`, {
        name,
        surname,
        phone
      });

      const updatedUserSession = { ...user, ...response.data };
      sessionStorage.setItem('user_session', JSON.stringify(updatedUserSession));
      
      setSuccess('Profilul a fost actualizat cu succes!');
      if (onUserUpdated) onUserUpdated(updatedUserSession);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Eroare la salvarea datelor.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateRo = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '10px', maxWidth: '650px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 5px 25px rgba(0,0,0,0.2)', fontFamily: 'sans-serif', overflow: 'hidden' }}>
        
        {/* Header Modal */}
        <div style={{ padding: '20px 25px', backgroundColor: '#e63946', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            👤 Profilul Meu & Istoric Donări
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {/* Corp Modal */}
        <div style={{ padding: '25px', overflowY: 'auto', flex: 1 }}>
          {error && <div style={{ backgroundColor: '#ffe3e3', color: '#dc3545', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px' }}>❌ {error}</div>}
          {success && <div style={{ backgroundColor: '#e3ffe3', color: '#198754', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px', fontWeight: 'bold' }}>✔️ {success}</div>}

          {/* SECȚIUNE 1: Date Personale */}
          <section style={{ marginBottom: '25px' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '8px' }}>
              📝 Date Personale
            </h4>
            <form onSubmit={handleSaveProfile}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Nume:</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Prenume:</label>
                  <input type="text" value={surname} onChange={(e) => setSurname(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Telefon:</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#666' }}>Email (needitabil):</label>
                <input type="email" value={user.email} disabled style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #eee', backgroundColor: '#f8f9fa', color: '#777', boxSizing: 'border-box' }} />
              </div>

              <button type="submit" disabled={loading} style={{ padding: '8px 18px', backgroundColor: '#2b2d42', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                {loading ? 'Se salvează...' : 'Salvează Modificările'}
              </button>
            </form>
          </section>

          {/* SECȚIUNE 2: Istoric Donări & Numărător */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f3f5', paddingBottom: '8px', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, color: '#2b2d42' }}>
                🩸 Istoric Participări Donare
              </h4>
              
              {/* AFISARE NUMARATOR DONARI EFECTIVE */}
              <div style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '5px 12px', borderRadius: '15px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #c8e6c9' }}>
                Total donări efectuate: {attendedCount}
              </div>
            </div>

            {personalAppointments.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', fontSize: '13px' }}>Nu aveți nicio programare proprie înregistrată în istoric.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '10px' }}>Campanie</th>
                      <th style={{ padding: '10px' }}>Dată</th>
                      <th style={{ padding: '10px' }}>Ora</th>
                      <th style={{ padding: '10px' }}>Status Donare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalAppointments.map((app) => (
                      <tr key={app.id} style={{ borderBottom: '1px solid #eceeef' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>{app.campaign_title || 'Campanie Donare'}</td>
                        <td style={{ padding: '10px' }}>{formatDateRo(app.appointment_date || app.campaign_date)}</td>
                        <td style={{ padding: '10px', color: '#e63946', fontWeight: 'bold' }}>{app.slot_time?.substring(0, 5)}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold',
                            backgroundColor: app.status === 'attended' ? '#d1e7dd' : app.status === 'confirmed' ? '#e3ffe3' : '#fff3cd',
                            color: app.status === 'attended' ? '#0f5132' : app.status === 'confirmed' ? '#198754' : '#856404'
                          }}>
                            {app.status === 'attended' ? 'Prezent ✓ (Donat)' : app.status === 'confirmed' ? 'Confirmată' : app.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Footer Modal */}
        <div style={{ padding: '12px 25px', backgroundColor: '#f8f9fa', borderTop: '1px solid #eee', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;