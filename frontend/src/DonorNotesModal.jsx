import React, { useState, useEffect } from 'react';
import axios from 'axios';

function DonorNotesModal({ donor, onClose, onNotesUpdated }) {
  const [notesHistory, setNotesHistory] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchNotesHistory = async () => {
    try {
      setLoading(true);
      setError('');
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
      const appId = donor.appointment_id || donor.id;
      await axios.put(`http://127.0.0.1:8000/appointments/${appId}/notes`, {
        notes: newNote
      });

      setSuccess('Observația a fost salvată cu succes!');
      setNewNote('');
      fetchNotesHistory();

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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '15px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '10px', maxWidth: '600px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 5px 25px rgba(0,0,0,0.2)', fontFamily: 'sans-serif', overflow: 'hidden' }}>

          <div style={{ padding: '15px 20px', backgroundColor: '#2b2d42', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🩺 Observații Medicale
              </h3>
              <span style={{ fontSize: '12px', color: '#adb5bd', marginTop: '3px', display: 'block' }}>
              {donor.donor_name} {donor.donor_surname} | 📞 {donor.donor_phone}
            </span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#fff' }}>
            {error && <div style={{ backgroundColor: '#ffe3e3', color: '#dc3545', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '12px' }}>❌ {error}</div>}
            {success && <div style={{ backgroundColor: '#e3ffe3', color: '#198754', padding: '10px', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', fontWeight: 'bold' }}>✔️ {success}</div>}

            <section style={{ backgroundColor: '#f8f9fa', padding: '12px 15px', borderRadius: '6px', border: '1px solid #dee2e6', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#2b2d42', fontSize: '13px' }}>✍️ Adaugă Observație Nouă</h4>
              <form onSubmit={handleAddNote}>
              <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ex: Tensiune ușor scăzută..."
                  rows="3"
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontFamily: 'sans-serif', fontSize: '12px', marginBottom: '8px' }}
              />
                <button
                    type="submit"
                    disabled={saving}
                    style={{ padding: '7px 14px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                >
                  {saving ? 'Se salvează...' : 'Adaugă'}
                </button>
              </form>
            </section>

            <section>
              <h4 style={{ margin: '0 0 12px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '6px', fontSize: '14px' }}>
                📜 Istoric Observații & Incidente
              </h4>

              {loading ? (
                  <p style={{ color: '#666', fontStyle: 'italic', fontSize: '12px' }}>Se încarcă istoricul...</p>
              ) : notesHistory.length === 0 ? (
                  <p style={{ color: '#666', fontStyle: 'italic', fontSize: '12px' }}>Nu există observații anterioare.</p>
              ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {notesHistory.map((item, idx) => (
                        <div key={idx} style={{ padding: '10px', borderRadius: '6px', backgroundColor: item.notes ? '#fffdf5' : '#f8f9fa', border: item.notes ? '1px solid #ffeba8' : '1px solid #e1e4e8' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#e63946' }}>
                        📍 {item.campaign_title}
                      </span>
                            <span style={{ fontSize: '10px', color: '#666' }}>
                        📅 {formatDateRo(item.campaign_date)} | 🕒 {item.slot_time?.substring(0, 5)}
                      </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '12px', color: item.notes ? '#333' : '#888', fontStyle: item.notes ? 'normal' : 'italic' }}>
                            {item.notes ? `📝 "${item.notes}"` : 'Fără observații la această donare.'}
                          </p>
                        </div>
                    ))}
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

export default DonorNotesModal;