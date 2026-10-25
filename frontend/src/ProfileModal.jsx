import React, { useState } from 'react';
import axios from 'axios';

function ProfileModal({ user, myAppointments, onClose, onUserUpdated }) {
  const [name, setName] = useState(user.name || '');
  const [surname, setSurname] = useState(user.surname || '');
  const [phone, setPhone] = useState(user.phone || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const personalAppointments = myAppointments
      ? myAppointments.filter(app => {
        const appName = (app.donor_name || '').trim().toLowerCase();
        const appSurname = (app.donor_surname || '').trim().toLowerCase();
        const userName = (user.name || '').trim().toLowerCase();
        const userSurname = (user.surname || '').trim().toLowerCase();

        if (app.user_id && user.id && String(app.user_id) === String(user.id)) {
          return true;
        }

        if (appName === userName && appSurname === userSurname) {
          return true;
        }

        if ((user.role === 'admin' || user.role === 'ADMIN') && appName === 'mihai' && appSurname === 'toma') {
          return true;
        }

        return false;
      })
      : [];

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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '15px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '10px', maxWidth: '650px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 5px 25px rgba(0,0,0,0.2)', fontFamily: 'sans-serif', overflow: 'hidden' }}>

          <div style={{ padding: '15px 20px', backgroundColor: '#e63946', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              👤 Profilul Meu & Istoric
            </h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            {error && <div style={{ backgroundColor: '#ffe3e3', color: '#dc3545', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '12px' }}>❌ {error}</div>}
            {success && <div style={{ backgroundColor: '#e3ffe3', color: '#198754', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', fontWeight: 'bold' }}>✔️ {success}</div>}

            <section style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '6px', fontSize: '14px' }}>
                📝 Date Personale
              </h4>
              <form onSubmit={handleSaveProfile}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}>Nume:</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}>Prenume:</label>
                    <input type="text" value={surname} onChange={(e) => setSurname(e.target.value)} required style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}>Telefon:</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '3px', color: '#666' }}>Email:</label>
                  <input type="email" value={user.email} disabled style={{ width: '100%', padding: '7px', borderRadius: '4px', border: '1px solid #eee', backgroundColor: '#f8f9fa', color: '#777', boxSizing: 'border-box', fontSize: '13px' }} />
                </div>

                <button type="submit" disabled={loading} style={{ padding: '7px 16px', backgroundColor: '#2b2d42', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                  {loading ? 'Se salvează...' : 'Salvează Modificările'}
                </button>
              </form>
            </section>

            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f3f5', paddingBottom: '6px', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ margin: 0, color: '#2b2d42', fontSize: '14px' }}>
                  🩸 Istoric Participări Donare
                </h4>

                <div style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #c8e6c9' }}>
                  Total donări: {attendedCount}
                </div>
              </div>

              {personalAppointments.length === 0 ? (
                  <p style={{ color: '#666', fontStyle: 'italic', fontSize: '12px' }}>Nu aveți nicio programare în istoric.</p>
              ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', minWidth: '400px' }}>
                      <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                        <th style={{ padding: '8px' }}>Campanie</th>
                        <th style={{ padding: '8px' }}>Dată</th>
                        <th style={{ padding: '8px' }}>Ora</th>
                        <th style={{ padding: '8px' }}>Status</th>
                      </tr>
                      </thead>
                      <tbody>
                      {personalAppointments.map((app) => (
                          <tr key={app.id || app.appointment_id} style={{ borderBottom: '1px solid #eceeef' }}>
                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{app.campaign_title || 'Campanie Donare'}</td>
                            <td style={{ padding: '8px' }}>{formatDateRo(app.appointment_date || app.campaign_date)}</td>
                            <td style={{ padding: '8px', color: '#e63946', fontWeight: 'bold' }}>{app.slot_time?.substring(0, 5)}</td>
                            <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 'bold',
                            backgroundColor: app.status === 'attended' ? '#d1e7dd' : app.status === 'confirmed' ? '#e3ffe3' : app.status === 'no_show' ? '#f8d7da' : '#fff3cd',
                            color: app.status === 'attended' ? '#0f5132' : app.status === 'confirmed' ? '#198754' : app.status === 'no_show' ? '#842029' : '#856404'
                          }}>
                            {app.status === 'attended' ? 'Prezent ✓' : app.status === 'confirmed' ? 'Confirmată' : app.status === 'no_show' ? 'Absent ✗' : app.status}
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

          <div style={{ padding: '10px 20px', backgroundColor: '#f8f9fa', borderTop: '1px solid #eee', textAlign: 'right' }}>
            <button onClick={onClose} style={{ padding: '7px 16px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              Închide
            </button>
          </div>
        </div>
      </div>
  );
}

ProfileModal.defaultProps = {
  myAppointments: []
};

export default ProfileModal;