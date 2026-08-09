import React, { useState, useEffect } from 'react';
import axios from 'axios';

function DonorNotesModal({ donor, onClose, onNotesUpdated }) {
  const [notesHistory, setNotesHistory] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Preluăm istoricul programărilor și al observațiilor pentru donatorul curent
  const fetchNotesHistory = async () => {
    try {
      setLoading(true);
      setError('');
      // Interogăm backend-ul pentru toate programările donatorului (după ID sau Telefon)
      const response = await axios.get(`http://127.0.0.1:8000/appointments/donor-history?phone=${encodeURIComponent(donor.donor_phone)}`);
      setNotesHistory(response.data);
    } catch (err) {
      setError('Nu s-a putut încărca istoricul observațiilor medicale.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (donor && donor.donor_phone) {
      fetchNotesHistory();
    }
  }, [donor]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Salvează noua observație pe programarea curentă
      const appId = donor.appointment_id || donor.id;
      await axios.put(`http://127.0.0.1:8000/appointments/${appId}/notes`, {
        notes: newNote
      });

      setSuccess('Observația a fost salvată cu succes!');
      setNewNote('');
      fetchNotesHistory(); // Reîncărcăm istoricul
      
      if (onNotesUpdated) onNotesUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Eroare la salvarea observației.');
    } finally {
      setSaving(false);
    }
  };

  const formatDateRo = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  if (!donor) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '10px', maxWidth: '600px', width: '92%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 5px 25px rgba(0,0,0,0.2)', fontFamily: 'sans-serif', overflow: 'hidden' }}>
        
        {/* Header Modal */}
        <div style={{ padding: '20px 25px', backgroundColor: '#2b2d42', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🩺 Observații Medicale Donator
            </h3>
            <span style={{ fontSize: '13px', color: '#adb5bd', marginTop: '4px', display: 'block' }}>
              {donor.donor_name} {donor.donor_surname} | 📞 {donor.donor_phone}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>

        {/* Corp Modal */}
        <div style={{ padding: '25px', overflowY: 'auto', flex: 1, backgroundColor: '#fff' }}>
          {error && <div style={{ backgroundColor: '#ffe3e3', color: '#dc3545', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px' }}>❌ {error}</div>}
          {success && <div style={{ backgroundColor: '#e3ffe3', color: '#198754', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px', fontWeight: 'bold' }}>✔️ {success}</div>}

          {/* Formular adăugare observație nouă */}
          <section style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px', border: '1px solid #dee2e6', marginBottom: '25px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#2b2d42', fontSize: '14px' }}>✍️ Adaugă Observație Nouă (Programare Curentă)</h4>
            <form onSubmit={handleAddNote}>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Ex: Tensiune ușor scăzută, i s-a făcut rău după donare, necesită repaus 15 minute..."
                rows="3"
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontFamily: 'sans-serif', fontSize: '13px', marginBottom: '10px' }}
              />
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '8px 16px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px' }}
              >
                {saving ? 'Se salvează...' : 'Adaugă Observația'}
              </button>
            </form>
          </section>

          {/* Istoric Observații din trecut */}
          <section>
            <h4 style={{ margin: '0 0 15px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '8px' }}>
              📜 Istoric Observații & Incidente
            </h4>

            {loading ? (
              <p style={{ color: '#666', fontStyle: 'italic', fontSize: '13px' }}>Se încarcă istoricul...</p>
            ) : notesHistory.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic', fontSize: '13px' }}>Nu există observații anterioare înregistrate pentru acest donator.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {notesHistory.map((item, idx) => (
                  <div key={idx} style={{ padding: '12px', borderRadius: '6px', backgroundColor: item.notes ? '#fffdf5' : '#f8f9fa', border: item.notes ? '1px solid #ffeba8' : '1px solid #e1e4e8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#e63946' }}>
                        📍 {item.campaign_title}
                      </span>
                      <span style={{ fontSize: '11px', color: '#666' }}>
                        📅 {formatDateRo(item.campaign_date)} | 🕒 {item.slot_time?.substring(0, 5)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: item.notes ? '#333' : '#888', fontStyle: item.notes ? 'normal' : 'italic' }}>
                      {item.notes ? `📝 "${item.notes}"` : 'Fără observații la această donare.'}
                    </p>
                  </div>
                ))}
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

export default DonorNotesModal;