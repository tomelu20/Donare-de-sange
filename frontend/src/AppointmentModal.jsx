import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AppointmentModal({ campaign, eligibilityQuestions = [], onClose, onRefresh, onOpenWaitlist, isAssigningFromWaitlist = false, waitlistId = null }) {
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState({ date: '', time: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [isForSomeoneElse, setIsForSomeoneElse] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestSurname, setGuestSurname] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [checklist, setChecklist] = useState({});

  useEffect(() => {
    if (eligibilityQuestions && eligibilityQuestions.length > 0) {
      const initialMap = {};
      eligibilityQuestions.forEach(q => {
        if (q.type === 'numeric') {
          initialMap[q.id] = '';
        } else if (q.type === 'radio') {
          initialMap[q.id] = null;
        } else {
          initialMap[q.id] = false;
        }
      });
      setChecklist(initialMap);
    }
  }, [eligibilityQuestions]);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`http://127.0.0.1:8000/campaigns/${campaign.id}/slots`);
      setSlots(response.data);
    } catch {
      setError('Nu s-au putut încărca intervalele orare.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [campaign.id]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!eligibilityQuestions || eligibilityQuestions.length === 0) {
      setIsEligible(true);
      return;
    }

    const allValid = eligibilityQuestions.every(q => {
      if (q.type === 'numeric') {
        const val = parseInt(checklist[q.id], 10);
        return !isNaN(val) && val > 0;
      }
      if (q.type === 'radio') {
        return checklist[q.id] !== null && checklist[q.id] !== undefined;
      }
      return checklist[q.id] === true;
    });

    setIsEligible(allValid);
  }, [checklist, eligibilityQuestions]);

  const groupedSlots = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) {
      acc[slot.date] = [];
    }
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const formatDateLabel = (dateStr, index) => {
    const dateObj = new Date(dateStr);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return `Ziua ${index + 1} (${dateObj.toLocaleDateString('ro-RO', options)})`;
  };

  const handleCheckboxChange = (id) => {
    setChecklist(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleInputChange = (id, value) => {
    setChecklist(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleConfirmAppointment = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isEligible && !isAssigningFromWaitlist) {
      setError('Nu vă puteți programa! Trebuie să accesați și să completați corect Formularul de Eligibilitate.');
      return;
    }

    if (!selectedSlot.time || !selectedSlot.date) {
      setError('Vă rugăm să selectați un interval orar.');
      return;
    }

    if (isForSomeoneElse && (!guestName || !guestSurname || !guestPhone)) {
      setError('Vă rugăm să completați toate datele persoanei pe care o programați.');
      return;
    }

    try {
      if (isAssigningFromWaitlist) {
        await axios.post(`http://127.0.0.1:8000/waitlist/${waitlistId}/assign?slot_time=${selectedSlot.time}`);
        setSuccess('Donatorul din lista de așteptare a fost asignat cu succes!');
      } else {
        await axios.post('http://127.0.0.1:8000/eligibility/submit', {
          appointment: {
            campaign_id: campaign.id,
            slot_time: selectedSlot.time,
            appointment_date: selectedSlot.date,
            is_for_someone_else: isForSomeoneElse,
            guest_name: isForSomeoneElse ? guestName : null,
            guest_surname: isForSomeoneElse ? guestSurname : null,
            guest_phone: isForSomeoneElse ? guestPhone : null,
            guest_blood_group: "Nu știu"
          },
          answers: Object.keys(checklist).map(qId => ({
            question_id: parseInt(qId, 10),
            answer_text: String(checklist[qId])
          }))
        });

        setSuccess('Felicitări! Te-ai programat cu succes, poți să-ți vezi programarea în secțiunea Programările Mele.');
      }

      if (onRefresh) onRefresh();
      setTimeout(() => {
        onClose();
      }, 4000);
    } catch (err) {
      setError(err.response?.data?.detail || 'A apărut o eroare la salvarea programării.');
    }
  };

  return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '10px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '650px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', fontFamily: 'sans-serif', overflow: 'hidden', boxSizing: 'border-box' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', padding: '15px 20px' }}>
            <h3 style={{ margin: 0, color: '#e63946', fontSize: '16px' }}>
              {isAssigningFromWaitlist ? `Asignare Waitlist: ${campaign.title}` : `Programare: ${campaign.title}`}
            </h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#999', lineHeight: '1' }}>&times;</button>
          </div>

          <div style={{ padding: '15px 20px', overflowY: 'auto', flex: 1, backgroundColor: '#fff' }}>
            {loading && <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>Se încarcă intervalele orare...</p>}

            {error && <p style={{ color: 'red', backgroundColor: '#ffe3e3', padding: '10px', borderRadius: '4px', fontSize: '13px', marginTop: '10px' }}>{error}</p>}
            {success && <p style={{ color: '#155724', backgroundColor: '#d4edda', borderLeft: '5px solid #28a745', padding: '10px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', marginTop: '10px', lineHeight: '1.4' }}>{success}</p>}

            {!loading && slots.length === 0 && <p style={{ color: '#666', padding: '20px', textAlign: 'center' }}>Nu există intervale orare disponibile.</p>}

            {!loading && slots.length > 0 && (
                <div style={{ paddingTop: '10px', paddingBottom: '10px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#555' }}>
                    Locație: <strong>{campaign.location_name}</strong> ({campaign.address})
                  </p>

                  {!isAssigningFromWaitlist && (
                      <div style={{ backgroundColor: '#fdf0f1', padding: '10px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #f9dadc' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#e63946', fontSize: '13px' }}>
                          <input
                              type="checkbox"
                              checked={isForSomeoneElse}
                              onChange={(e) => setIsForSomeoneElse(e.target.checked)}
                              style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                          />
                          Programez pentru altcineva
                        </label>

                        {isForSomeoneElse && (
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', marginBottom: '2px', color: '#333' }}>Nume:</label>
                                <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} required style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }} />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', marginBottom: '2px', color: '#333' }}>Prenume:</label>
                                <input type="text" value={guestSurname} onChange={(e) => setGuestSurname(e.target.value)} required style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }} />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', marginBottom: '2px', color: '#333' }}>Telefon:</label>
                                <input type="text" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontSize: '13px' }} placeholder="07XXXXXXXX" />
                              </div>
                            </div>
                        )}
                      </div>
                  )}

                  {!isAssigningFromWaitlist && (
                      <div style={{
                        backgroundColor: isEligible ? '#e2f0d9' : '#fff3cd',
                        color: isEligible ? '#385723' : '#856404',
                        padding: '10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        marginBottom: '15px',
                        border: isEligible ? '1px solid #c5e0b4' : '1px solid #ffeeba'
                      }}>
                        {isEligible
                            ? '✓ Chestionar completat corect!'
                            : '⚠ Completează Formularul de Eligibilitate.'
                        }
                      </div>
                  )}

                  {Object.keys(groupedSlots).map((dateKey, dayIndex) => (
                      <div key={dateKey} style={{ marginBottom: '15px', borderBottom: Object.keys(groupedSlots).length > 1 ? '1px dashed #eee' : 'none', paddingBottom: '10px' }}>

                        <h4 style={{ margin: '8px 0', color: '#333', fontSize: '13px', backgroundColor: '#f8f9fa', padding: '6px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                          {formatDateLabel(dateKey, dayIndex)}
                        </h4>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', gap: '8px', marginTop: '8px' }}>
                          {groupedSlots[dateKey].map((slot) => {
                            const isDisabled = slot.available_slots <= 0;
                            const isSelected = selectedSlot.time === slot.time && selectedSlot.date === slot.date;

                            return (
                                <button
                                    key={`${slot.date}-${slot.time}`}
                                    type="button"
                                    disabled={isDisabled}
                                    onClick={() => setSelectedSlot({ date: slot.date, time: slot.time })}
                                    style={{
                                      padding: '6px 4px',
                                      borderRadius: '4px',
                                      border: isSelected ? '2px solid #e63946' : '1px solid #ccc',
                                      backgroundColor: isSelected ? '#ffe3e3' : isDisabled ? '#f0f0f0' : '#fff',
                                      color: isDisabled ? '#999' : '#333',
                                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                      fontSize: '12px'
                                    }}
                                >
                                  {slot.time.substring(0, 5)}
                                  <span style={{ display: 'block', fontSize: '9px', color: isDisabled ? '#999' : '#666', marginTop: '2px' }}>
                            {slot.available_slots}/{campaign.capacity_per_slot} locuri
                          </span>
                                </button>
                            );
                          })}
                        </div>
                      </div>
                  ))}
                </div>
            )}
          </div>

          {!loading && slots.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #eee', padding: '12px 20px', backgroundColor: '#fdfdfd', alignItems: 'center', flexWrap: 'wrap' }}>

                {!isAssigningFromWaitlist && (
                    <button
                        type="button"
                        disabled={!isEligible}
                        onClick={() => onOpenWaitlist(campaign)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: isEligible ? '#2b2d42' : '#73758a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isEligible ? 'pointer' : 'not-allowed',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}
                    >
                      Waitlist
                    </button>
                )}

                {!isAssigningFromWaitlist && (
                    <button
                        type="button"
                        onClick={() => setShowEligibilityModal(true)}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: isEligible ? '#198754' : '#ffc107',
                          color: isEligible ? 'white' : '#333',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}
                    >
                      {isEligible ? '✓ Eligibilitate' : '📋 Verifică'}
                    </button>
                )}

                <button
                    type="button"
                    onClick={onClose}
                    style={{ padding: '8px 12px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Anulează
                </button>

                <button
                    type="button"
                    onClick={handleConfirmAppointment}
                    disabled={!isEligible && !isAssigningFromWaitlist}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: isAssigningFromWaitlist ? '#198754' : (isEligible ? '#e63946' : '#cca3a6'),
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: (!isEligible && !isAssigningFromWaitlist) ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                >
                  {isAssigningFromWaitlist ? 'Confirmă' : 'Rezervă'}
                </button>
              </div>
          )}
        </div>

        {showEligibilityModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '10px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '500px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', boxShadow: '0 5px 25px rgba(0,0,0,0.3)', overflow: 'hidden' }}>

                <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee' }}>
                  <h3 style={{ margin: '0 0 5px 0', color: '#2b2d42', borderBottom: '2px solid #e63946', paddingBottom: '6px', fontSize: '15px' }}>
                    📋 Asigura-te ca poti dona
                  </h3>
                  <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0 0', lineHeight: '1.4' }}>
                    Bifează criteriile de mai jos pentru a valida eligibilitatea ta.
                  </p>
                </div>

                <div style={{ padding: '15px 20px', overflowY: 'auto', flex: 1, backgroundColor: '#fff' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {eligibilityQuestions.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>Nu există întrebări de eligibilitate active.</p>
                    ) : (
                        eligibilityQuestions.map((q) => (
                            <div key={q.id} style={{ borderBottom: '1px solid #f1f3f5', paddingBottom: '10px' }}>

                              {q.type === 'numeric' && (
                                  <>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#333', marginBottom: '6px' }}>
                            {q.question_text}
                          </span>
                                    <input
                                        type="number"
                                        value={checklist[q.id] || ''}
                                        onChange={(e) => handleInputChange(q.id, e.target.value)}
                                        placeholder="Introduceți valoarea..."
                                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px', boxSizing: 'border-box' }}
                                    />
                                  </>
                              )}

                              {q.type === 'radio' && (
                                  <>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#333', marginBottom: '6px' }}>
                            {q.question_text}
                          </span>
                                    <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name={`radio-${q.id}`}
                                            checked={checklist[q.id] === 'da'}
                                            onChange={() => handleInputChange(q.id, 'da')}
                                        />
                                        Da
                                      </label>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name={`radio-${q.id}`}
                                            checked={checklist[q.id] === 'nu'}
                                            onChange={() => handleInputChange(q.id, 'nu')}
                                        />
                                        Nu
                                      </label>
                                    </div>
                                  </>
                              )}

                              {(q.type === 'checkbox' || !q.type) && (
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500', color: '#333', cursor: 'pointer', width: '100%' }}>
                                    <input
                                        type="checkbox"
                                        checked={!!checklist[q.id]}
                                        onChange={() => handleCheckboxChange(q.id)}
                                        style={{ cursor: 'pointer', transform: 'scale(1.1)', flexShrink: 0 }}
                                    />
                                    <span>{q.question_text}</span>
                                  </label>
                              )}
                            </div>
                        ))
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fdfdfd' }}>
                  <button
                      type="button"
                      onClick={() => setShowEligibilityModal(false)}
                      style={{
                        padding: '8px 18px',
                        backgroundColor: isEligible ? '#198754' : '#e63946',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}
                  >
                    {isEligible ? 'Validează & Continuă' : 'Închide'}
                  </button>
                </div>

              </div>
            </div>
        )}

      </div>
  );
}

export default AppointmentModal;