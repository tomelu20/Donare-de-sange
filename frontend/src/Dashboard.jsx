import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AppointmentModal from './AppointmentModal'; 
import WaitlistModal from './WaitlistModal'; 
import AIChatbox from './AIChatbox';
import ProfileModal from './ProfileModal';

function Dashboard({ onLogout }) {
  const savedUser = sessionStorage.getItem('user_session'); 
  const user = savedUser ? JSON.parse(savedUser) : null; 

  const [currentUser, setCurrentUser] = useState(user);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [campaigns, setCampaigns] = useState([]); 
  const [myAppointments, setMyAppointments] = useState([]); 
  const [adminAppointments, setAdminAppointments] = useState([]); 
  const [adminWaitlist, setAdminWaitlist] = useState([]); 
  const [topDonors, setTopDonors] = useState([]); 
  
  // State-uri pentru observații per programare
  const [notesState, setNotesState] = useState({});

  // --- STATE-URI NOI PENTRU FILTRARE, CĂUTARE ȘI PAGINARE ADMIN ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [eligibilityQuestions, setEligibilityQuestions] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState('checkbox');

  const [loading, setLoading] = useState(true); 
  const [apiError, setApiError] = useState(''); 
  const [selectedCampaign, setSelectedCampaign] = useState(null); 
  const [waitlistCampaign, setWaitlistCampaign] = useState(null); 
  const [assignModalData, setAssignModalData] = useState(null); 

  const [appointmentToCancel, setAppointmentToCancel] = useState(null); 
  const [successNotification, setSuccessNotification] = useState(''); 

  const [reminderConfirmModal, setReminderConfirmModal] = useState({ isOpen: false, campaign: null });
  const [reminderResultModal, setReminderResultModal] = useState({ isOpen: false, isSuccess: true, message: '' });

  // Formular Campanie
  const [newCampTitle, setNewCampTitle] = useState('');
  const [newCampLocation, setNewCampLocation] = useState('');
  const [newCampAddress, setNewCampAddress] = useState('');
  const [newCampDate, setNewCampDate] = useState('');
  const [newCampEndDate, setNewCampEndDate] = useState(''); 
  const [newCampStartTime, setNewCampStartTime] = useState('08:30');
  const [newCampEndTime, setNewCampEndTime] = useState('13:00');
  const [newCampSlotDuration, setNewCampSlotDuration] = useState('15');
  const [newCampCapacityPerSlot, setNewCampCapacityPerSlot] = useState('2');

  const fetchData = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setApiError('');

      // 1. Preluăm toate campaniile
      const campaignsRes = await axios.get('http://127.0.0.1:8000/campaigns/');
      setCampaigns(campaignsRes.data);

      // 2. Preluăm întrebările de eligibilitate
      const questionsRes = await axios.get('http://127.0.0.1:8000/eligibility/questions');
      setEligibilityQuestions(questionsRes.data);

      // 3. Preluăm programările proprii
      const myAppsRes = await axios.get(`http://127.0.0.1:8000/appointments/me?user_id=${currentUser.id}`);
      setMyAppointments(myAppsRes.data);

      // 4. Dacă utilizatorul este Admin, preluăm datele administrative globale
      if (currentUser.role === 'admin' || currentUser.role === 'ADMIN') {
        const adminAppsRes = await axios.get('http://127.0.0.1:8000/appointments/all');
        setAdminAppointments(adminAppsRes.data);

        // Populează starea inițială pentru observații
        const initialNotes = {};
        adminAppsRes.data.forEach(app => {
          initialNotes[app.appointment_id || app.id] = app.notes || '';
        });
        setNotesState(initialNotes);

        const adminWaitlistRes = await axios.get('http://127.0.0.1:8000/waitlist/all');
        setAdminWaitlist(adminWaitlistRes.data);

        // Preluăm clasamentul celor mai activi donatori
        const topDonorsRes = await axios.get('http://127.0.0.1:8000/appointments/top-donors');
        setTopDonors(topDonorsRes.data);
      }
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Nu s-au putut încărca datele de la server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- LOGICĂ PENTRU FILTRARE ȘI PAGINARE ---
  const filteredAppointments = adminAppointments.filter(app => {
    // 1. Filtrare Căutare după Nume, Prenume sau Telefon
    const fullName = `${app.donor_name || ''} ${app.donor_surname || ''}`.toLowerCase();
    const phone = `${app.donor_phone || ''}`;
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);

    // 2. Filtrare după Campanie
    const matchesCampaign = selectedCampaignFilter === 'all' || String(app.campaign_title) === String(selectedCampaignFilter);

    // 3. Filtrare după Status
    const matchesStatus = selectedStatusFilter === 'all' || app.status === selectedStatusFilter;

    return matchesSearch && matchesCampaign && matchesStatus;
  });

  // Calculare Pagini
  const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE) || 1;
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentAppointments = filteredAppointments.slice(indexOfFirstItem, indexOfLastItem);

  // Resetare pagină la schimbarea filtrelor
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCampaignFilter, selectedStatusFilter]);

  // Salvare Observație Medicală
  const handleSaveNotes = async (appId) => {
    try {
      await axios.put(`http://127.0.0.1:8000/appointments/${appId}/notes`, {
        notes: notesState[appId] || ''
      });
      setSuccessNotification('Observația a fost salvată cu succes!');
      setTimeout(() => setSuccessNotification(''), 3000);
    } catch (err) {
      setApiError('Nu s-a putut salva observația.');
    }
  };

  // Trecere campanie în stare Finalizată / Activă
  const handleToggleCampaignStatus = async (campId) => {
    try {
      const res = await axios.put(`http://127.0.0.1:8000/campaigns/${campId}/toggle-status`);
      setSuccessNotification(res.data.message);
      fetchData();
      setTimeout(() => setSuccessNotification(''), 3000);
    } catch (err) {
      setApiError('Eroare la schimbarea statusului campaniei.');
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    try {
      await axios.post('http://127.0.0.1:8000/eligibility/questions', {
        question_text: newQuestionText,
        type: newQuestionType
      });
      setSuccessNotification('Întrebarea a fost adăugată cu succes!');
      setNewQuestionText('');
      
      const questionsRes = await axios.get('http://127.0.0.1:8000/eligibility/questions');
      setEligibilityQuestions(questionsRes.data);
      setTimeout(() => setSuccessNotification(''), 3000);
    } catch (err) {
      setApiError('Eroare la adăugarea întrebării.');
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Sigur doriți să ștergeți această întrebare?')) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/eligibility/questions/${questionId}`);
      setSuccessNotification('Întrebarea a fost ștearsă cu succes!');
      
      const questionsRes = await axios.get('http://127.0.0.1:8000/eligibility/questions');
      setEligibilityQuestions(questionsRes.data);
      setTimeout(() => setSuccessNotification(''), 3000);
    } catch (err) {
      setApiError('Eroare la ștergerea întrebării.');
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setApiError('');

    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dateRegex.test(newCampDate)) {
      setApiError('Data de început trebuie să fie în formatul ZZ-LL-AAAA (ex: 10-10-2026).');
      return;
    }
    if (!dateRegex.test(newCampEndDate)) {
      setApiError('Data de sfârșit trebuie să fie în formatul ZZ-LL-AAAA (ex: 12-10-2026).');
      return;
    }

    const [startDay, startMonth, startYear] = newCampDate.split('-');
    const formattedStartDate = `${startYear}-${startMonth}-${startDay}`;

    const [endDay, endMonth, endYear] = newCampEndDate.split('-');
    const formattedEndDate = `${endYear}-${endMonth}-${endDay}`;

    if (new Date(formattedStartDate) > new Date(formattedEndDate)) {
      setApiError('Data de început nu poate fi mai mare decât data de sfârșit.');
      return;
    }

    try {
      await axios.post('http://127.0.0.1:8000/campaigns/', {
        title: newCampTitle,
        location_name: newCampLocation,
        address: newCampAddress,
        date: formattedStartDate,
        end_date: formattedEndDate,
        start_time: `${newCampStartTime}:00`,
        end_time: `${newCampEndTime}:00`,
        slot_duration: parseInt(newCampSlotDuration),
        capacity_per_slot: parseInt(newCampCapacityPerSlot)
      });

      setSuccessNotification('Campania a fost creată cu succes!');
      
      setNewCampTitle('');
      setNewCampLocation('');
      setNewCampAddress('');
      setNewCampDate('');
      setNewCampEndDate('');
      setNewCampStartTime('08:30');
      setNewCampEndTime('13:00');
      setNewCampSlotDuration('15');
      setNewCampCapacityPerSlot('2');

      fetchData();
      setTimeout(() => setSuccessNotification(''), 3000);
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Eroare la crearea campaniei.');
    }
  };

  const handleCancelClick = (appId) => {
    setAppointmentToCancel(appId);
  };

  const executeCancel = async () => {
    if (!appointmentToCancel) return;
    try {
      await axios.put(`http://127.0.0.1:8000/appointments/${appointmentToCancel}/cancel`);
      setSuccessNotification('Programarea a fost anulată cu succes.');
      setAppointmentToCancel(null);
      fetchData();
      setTimeout(() => setSuccessNotification(''), 3000);
    } catch (err) {
      setApiError('Nu s-a putut anula programarea.');
      setAppointmentToCancel(null);
    }
  };

  const handleMarkAttendance = async (appId) => {
    try {
      await axios.put(`http://127.0.0.1:8000/appointments/${appId}/attend`);
      setSuccessNotification('Donatorul a fost marcat ca Prezent.');
      fetchData();
      setTimeout(() => setSuccessNotification(''), 3000);
    } catch (err) {
      setApiError('Eroare la actualizarea statusului.');
    }
  };

  const handleMarkNoShow = async (appId) => {
    try {
      await axios.put(`http://127.0.0.1:8000/appointments/${appId}/noshow`);
      setSuccessNotification('Donatorul a fost marcat ca Absent.');
      fetchData();
      setTimeout(() => setSuccessNotification(''), 3000);
    } catch (err) {
      setApiError('Eroare la actualizarea statusului.');
    }
  };

  const handleAssignWaitlist = (waitId, campaignId, campaignTitle) => {
    setAssignModalData({
      campaign: { id: campaignId, title: campaignTitle },
      waitlistId: waitId
    });
  };

  const formatDateRo = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  };

  const formatTimeShort = (timeString) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const executeSendReminders = async () => {
    const camp = reminderConfirmModal.campaign;
    if (!camp) return;
    
    setReminderConfirmModal({ isOpen: false, campaign: null });

    try {
      const response = await axios.post(`http://127.0.0.1:8000/reminders/campaign/${camp.id}?current_user_id=${currentUser.id}`);
      setReminderResultModal({
        isOpen: true,
        isSuccess: true,
        message: response.data.detail
      });
    } catch (err) {
      setReminderResultModal({
        isOpen: true,
        isSuccess: false,
        message: err.response?.data?.detail || 'Nu există programări active (confirmate) sau a apărut o eroare.'
      });
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', backgroundColor: '#f8f9fa', minHeight: '100vh', paddingBottom: '50px' }}>
      
      {/* NAVBAR PRINCIPAL */}
      <nav style={{ backgroundColor: '#fff', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '24px' }}>🩸</span>
          <h2 style={{ margin: 0, color: '#e63946', fontSize: '22px', fontWeight: 'bold' }}>Platformă Donare Sânge</h2>
          
          {currentUser && (
            <button 
              onClick={() => setShowProfileModal(true)}
              style={{ padding: '7px 14px', backgroundColor: '#fdf0f1', color: '#e63946', border: '1px solid #f9dadc', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              👤 Profilul Meu
            </button>
          )}
        </div>

        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 'bold', color: '#333' }}>{currentUser.name} {currentUser.surname}</span>
              <span style={{ fontSize: '12px', color: 'white', backgroundColor: '#e63946', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {currentUser.role === 'admin' || currentUser.role === 'ADMIN' ? 'Administrator' : 'Donator'}
              </span>
            </div>
            <button onClick={onLogout} style={{ padding: '8px 16px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Deconectare
            </button>
          </div>
        )}
      </nav>

      <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
        
        {/* NOTIFICĂRI */}
        {successNotification && <div style={{ backgroundColor: '#e3ffe3', color: '#198754', padding: '15px', borderRadius: '6px', marginBottom: '20px', borderLeft: '5px solid #198754', fontWeight: 'bold' }}>✔️ {successNotification}</div>}
        {apiError && <div style={{ backgroundColor: '#ffe3e3', color: '#dc3545', padding: '15px', borderRadius: '6px', marginBottom: '20px', borderLeft: '5px solid #dc3545', fontWeight: 'bold' }}>❌ {apiError}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', fontSize: '18px', color: '#666' }}>Se încarcă datele panoului...</div>
        ) : (
          <>
            {/* MANAGEMENT REZERVĂRI ADMIN */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') && (
              <>
                <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #e1e4e8' }}>
                  
                  <h3 style={{ margin: '0 0 20px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '10px' }}>
                    📋 Centralizator Management Programări (Vizualizare Medicală)
                  </h3>

                  {/* BARĂ NOUĂ DE FILTRARE & CĂUTARE */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: '15px', marginBottom: '20px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px', border: '1px solid #eee' }}>
                    
                    {/* Căutare Nume/Telefon */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>🔍 Căutare Donator:</label>
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Nume, prenume sau telefon..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Filtru Campanie */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>📍 Filtrează după Campanie:</label>
                      <select 
                        value={selectedCampaignFilter}
                        onChange={(e) => setSelectedCampaignFilter(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', backgroundColor: 'white', boxSizing: 'border-box' }}
                      >
                        <option value="all">Toate Campaniile</option>
                        {campaigns.map(c => (
                          <option key={c.id} value={c.title}>{c.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Filtru Status */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>📌 Filtrează după Status:</label>
                      <select 
                        value={selectedStatusFilter}
                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', backgroundColor: 'white', boxSizing: 'border-box' }}
                      >
                        <option value="all">Toate Statusurile</option>
                        <option value="confirmed">Confirmată</option>
                        <option value="attended">Prezent ✓</option>
                        <option value="no_show">Absent ✗</option>
                      </select>
                    </div>
                  </div>

                  {filteredAppointments.length === 0 ? (
                    <p style={{ color: '#666', fontStyle: 'italic', padding: '15px 0' }}>Nu s-a găsit nicio programare conform filtrelor selectate.</p>
                  ) : (
                    <>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                              <th style={{ padding: '12px' }}>Donator</th>
                              <th style={{ padding: '12px' }}>Telefon</th>
                              <th style={{ padding: '12px' }}>Campanie</th>
                              <th style={{ padding: '12px' }}>Dată & Oră</th>
                              <th style={{ padding: '12px' }}>Status</th>
                              <th style={{ padding: '12px' }}>Observații Medicale / Incident</th>
                              <th style={{ padding: '12px', textAlign: 'center' }}>Acțiuni Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentAppointments.map((app) => {
                              const appId = app.appointment_id || app.id;
                              return (
                                <tr key={appId} style={{ borderBottom: '1px solid #eceeef' }}>
                                  <td style={{ padding: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {app.donor_name} {app.donor_surname}
                                  </td>
                                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                                    {app.donor_phone}
                                  </td>
                                  <td style={{ padding: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                    {app.campaign_title}
                                  </td>
                                  <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                                    {formatDateRo(app.campaign_date)} | <strong style={{ color: '#e63946' }}>{formatTimeShort(app.slot_time)}</strong>
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                    <span style={{
                                      padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap',
                                      backgroundColor: app.status === 'confirmed' ? '#e3ffe3' : app.status === 'attended' ? '#d1e7dd' : '#fff3cd',
                                      color: app.status === 'confirmed' ? '#198754' : app.status === 'attended' ? '#0f5132' : '#856404'
                                    }}>
                                      {app.status === 'confirmed' ? 'Confirmată' : app.status === 'attended' ? 'Prezent ✓' : 'Absent ✗'}
                                    </span>
                                  </td>

                                  <td style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                      <input 
                                        type="text" 
                                        value={notesState[appId] || ''} 
                                        onChange={(e) => setNotesState({ ...notesState, [appId]: e.target.value })}
                                        placeholder="Ex: I s-a făcut rău, amețeală..."
                                        style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '12px', width: '180px' }}
                                      />
                                      <button 
                                        onClick={() => handleSaveNotes(appId)} 
                                        style={{ padding: '5px 8px', backgroundColor: '#2b2d42', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                                        💾
                                      </button>
                                    </div>
                                  </td>

                                  <td style={{ padding: '12px', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                    <button onClick={() => handleMarkAttendance(appId)} disabled={app.status === 'attended'} style={{ padding: '6px 8px', backgroundColor: app.status === 'attended' ? '#ccc' : '#198754', color: 'white', border: 'none', borderRadius: '4px', cursor: app.status === 'attended' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Prezent</button>
                                    <button onClick={() => handleMarkNoShow(appId)} disabled={app.status === 'no_show'} style={{ padding: '6px 8px', backgroundColor: app.status === 'no_show' ? '#ccc' : '#ffc107', color: '#333', border: 'none', borderRadius: '4px', cursor: app.status === 'no_show' ? 'not-allowed' : 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Absent</button>
                                    <button onClick={() => handleCancelClick(appId)} style={{ padding: '6px 8px', backgroundColor: '#fff', border: '1px solid #dc3545', color: '#dc3545', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Anulează</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* CONTROALE PAGINARE (CÂTE 10 PE PAGINĂ) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #eee' }}>
                        <span style={{ fontSize: '13px', color: '#666' }}>
                          Afișare <strong>{indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredAppointments.length)}</strong> din <strong>{filteredAppointments.length}</strong> programări
                        </span>
                        
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button 
                            disabled={currentPage === 1} 
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            style={{ padding: '6px 12px', backgroundColor: currentPage === 1 ? '#e9ecef' : '#2b2d42', color: currentPage === 1 ? '#6c757d' : 'white', border: 'none', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            ◄ Anterior
                          </button>
                          
                          <span style={{ fontSize: '13px', padding: '0 8px', fontWeight: 'bold', color: '#333' }}>
                            Pagina {currentPage} din {totalPages}
                          </span>

                          <button 
                            disabled={currentPage === totalPages} 
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            style={{ padding: '6px 12px', backgroundColor: currentPage === totalPages ? '#e9ecef' : '#2b2d42', color: currentPage === totalPages ? '#6c757d' : 'white', border: 'none', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                            Următor ►
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                {/* SECȚIUNE TOP 10 DONATORI */}
                <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid #e1e4e8' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '10px' }}>
                    🏆 Top 10 Donatori (Efectivi)
                  </h3>
                  {topDonors.length === 0 ? (
                    <p style={{ color: '#666', fontStyle: 'italic', fontSize: '13px' }}>Nu există încă donări confirmate cu statusul 'Prezent'.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ padding: '10px 12px', width: '60px' }}>Loc</th>
                            <th style={{ padding: '10px 12px' }}>Donator</th>
                            <th style={{ padding: '10px 12px' }}>Grupă Sanguină</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center' }}>Total Donări Reale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topDonors.map((donor, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eceeef' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>
                                {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `${idx + 1}`}
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#2b2d42' }}>
                                {donor.name} {donor.surname}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ backgroundColor: '#fdf0f1', color: '#e63946', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>
                                  {donor.blood_group}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <strong style={{ color: '#2e7d32', backgroundColor: '#e8f5e9', padding: '4px 12px', borderRadius: '12px', border: '1px solid #c8e6c9' }}>
                                  {donor.total_donations} donări
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* CENTRALIZATOR WAITLIST */}
                <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '40px', border: '1px solid #e1e4e8' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '10px' }}>
                    📝 Centralizator Listă de Așteptare (Waitlist Inteligent)
                  </h3>
                  {adminWaitlist.length === 0 ? (
                    <p style={{ color: '#666', fontStyle: 'italic' }}>Nu există nicio persoană înscrisă în lista de așteptare.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                            <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>Donator</th>
                            <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>Telefon</th>
                            <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>Campanie Alocată</th>
                            <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>Interval Preferat</th>
                            <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>Timp Deplasare</th>
                            <th style={{ padding: '12px', whiteSpace: 'nowrap' }}>Status</th>
                            <th style={{ padding: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Acțiuni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminWaitlist.map((wait) => (
                            <tr key={wait.id} style={{ borderBottom: '1px solid #eceeef' }}>
                              <td style={{ padding: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                {wait.name} {wait.surname}
                              </td>
                              <td style={{ padding: '12px', fontSize: '14px', whiteSpace: 'nowrap' }}>
                                📞 {wait.phone}
                              </td>
                              <td style={{ padding: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                {wait.campaign_title}
                              </td>
                              <td style={{ padding: '12px', fontWeight: 'bold', color: '#e63946', whiteSpace: 'nowrap' }}>
                                {wait.preferred_time_range}
                              </td>
                              <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                                ⏱️ {wait.travel_time_minutes} min
                              </td>
                              <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                                  backgroundColor: wait.status === 'accepted' ? '#d1e7dd' : '#fff3cd', 
                                  color: wait.status === 'accepted' ? '#0f5132' : '#856404'
                                }}>
                                  {wait.status === 'waiting' ? 'În așteptare' : wait.status === 'accepted' ? 'Asignat ✓' : wait.status}
                                </span>
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <button 
                                  onClick={() => handleAssignWaitlist(wait.id, wait.campaign_id, wait.campaign_title)}
                                  disabled={wait.status === 'accepted'}
                                  style={{ 
                                    padding: '6px 12px', 
                                    backgroundColor: wait.status === 'accepted' ? '#ccc' : '#e63946', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '4px', 
                                    cursor: wait.status === 'accepted' ? 'not-allowed' : 'pointer', 
                                    fontSize: '11px', 
                                    fontWeight: 'bold' 
                                  }}
                                >
                                  Asignează
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* MANAGEMENT CHESTIONAR ELIGIBILITATE */}
                <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '40px', border: '1px solid #e1e4e8' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '10px' }}>
                    ⚙️ Management Chestionar Eligibilitate
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
                    <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                      <h4 style={{ margin: '0 0 15px 0', color: '#e63946', fontSize: '15px' }}>🆕 Adaugă Întrebare Nouă</h4>
                      <form onSubmit={handleAddQuestion}>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>Text Întrebare:</label>
                          <textarea 
                            value={newQuestionText} 
                            onChange={(e) => setNewQuestionText(e.target.value)} 
                            required 
                            rows="2"
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
                            placeholder="Ex: Am peste 50 kg"
                          />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                          <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>Tip Răspuns:</label>
                          <select value={newQuestionType} onChange={(e) => setNewQuestionType(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}>
                            <option value="checkbox">Căsuță de bifat (Checkbox)</option>
                            <option value="radio">Opțiune DA/NU (Radio)</option>
                            <option value="numeric">Valoare Numerică</option>
                          </select>
                        </div>
                        <button type="submit" style={{ width: '100%', padding: '9px', backgroundColor: '#2b2d42', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                          Adaugă în Chestionar
                        </button>
                      </form>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 15px 0', color: '#333', fontSize: '15px' }}>📋 Întrebări Active:</h4>
                      {eligibilityQuestions.length === 0 ? (
                        <p style={{ color: '#666', fontStyle: 'italic', fontSize: '13px' }}>Nu există întrebări active în baza de date.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                          {eligibilityQuestions.map((q) => (
                            <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#fff', border: '1px solid #e1e4e8', borderRadius: '4px' }}>
                              <span style={{ fontSize: '13px', color: '#333' }}><strong>•</strong> {q.question_text}</span>
                              <button 
                                type="button" 
                                onClick={() => handleDeleteQuestion(q.id)}
                                style={{ padding: '5px 9px', backgroundColor: '#fff', border: '1px solid #dc3545', color: '#dc3545', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                              >
                                Șterge
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* SECȚIUNEA DE JOS: FORMULAR + LISTARE CAMPANII */}
            <div style={{ display: 'grid', gridTemplateColumns: (currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') ? '1fr 2fr' : '2fr 1fr', gap: '30px', alignItems: 'start' }}>
              
              {(currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') && (
                <section style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e1e4e8' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '10px' }}>🆕 Adaugă Campanie Nouă</h3>
                  <form onSubmit={handleCreateCampaign}>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Titlu Campanie:</label>
                      <input type="text" value={newCampTitle} onChange={(e) => setNewCampTitle(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} placeholder="Ex: Donare de Primăvară" />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Nume Centru / Locație:</label>
                      <input type="text" value={newCampLocation} onChange={(e) => setNewCampLocation(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} placeholder="Ex: Sala Polivalenta" />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Adresă Exactă:</label>
                      <input type="text" value={newCampAddress} onChange={(e) => setNewCampAddress(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} placeholder="Ex: Str. Codrului, Nr. 12" />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Data Început:</label>
                        <input type="date" value={newCampDate} onChange={(e) => setNewCampDate(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Data Sfârșit:</label>
                        <input type="date" value={newCampEndDate} onChange={(e) => setNewCampEndDate(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Ora Start:</label>
                        <input type="time" value={newCampStartTime} onChange={(e) => setNewCampStartTime(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Ora Final:</label>
                        <input type="time" value={newCampEndTime} onChange={(e) => setNewCampEndTime(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Minut / Slot:</label>
                        <input type="number" value={newCampSlotDuration} onChange={(e) => setNewCampSlotDuration(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Capacitate / Slot:</label>
                        <input type="number" value={newCampCapacityPerSlot} onChange={(e) => setNewCampCapacityPerSlot(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Publică Campania Activă</button>
                  </form>
                </section>
              )}
              
              {/* VIZUALIZARE CAMPANII ACTIVE ȘI ISTORIC (FINALIZATE) */}
              <main style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e1e4e8' }}>
                <h3 style={{ margin: '0 0 20px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '10px' }}>📍 Campanii de Donare & Istoric</h3>
                {campaigns.length === 0 ? (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>Momentan nu există campanii înregistrate.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                    {campaigns.map((camp) => (
                      <div key={camp.id} style={{ 
                        border: '1px solid #e1e4e8', 
                        borderRadius: '6px', 
                        padding: '20px', 
                        display: 'flex', 
                        justify: 'space-between', 
                        alignItems: 'center', 
                        backgroundColor: camp.is_active ? '#fff' : '#f8f9fa',
                        opacity: camp.is_active ? 1 : 0.75
                      }}>
                        <div style={{ flex: 1, paddingRight: '15px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h4 style={{ margin: '0 0 8px 0', color: camp.is_active ? '#e63946' : '#6c757d', fontSize: '18px' }}>
                              {camp.title}
                            </h4>
                            {!camp.is_active && (
                              <span style={{ fontSize: '11px', backgroundColor: '#6c757d', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                Finalizată
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#333' }}><strong>Locație:</strong> {camp.location_name}</p>
                          <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666' }}><strong>Adresă:</strong> {camp.address}</p>
                          <div style={{ display: 'flex', gap: '15px', marginTop: '10px', fontSize: '13px', color: '#444', flexWrap: 'wrap' }}>
                            <span>📅 <strong>Perioadă:</strong> {formatDateRo(camp.date)}{camp.end_date && camp.end_date !== camp.date ? ` -> ${formatDateRo(camp.end_date)}` : ''}</span>
                            <span>🕒 <strong>Program:</strong> {formatTimeShort(camp.start_time)} - {formatTimeShort(camp.end_time)}</span>
                          </div>
                        </div>

                        {/* BUTOANE PENTRU ADMIN ȘI UTILIZATORI */}
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          
                          {/* ADMIN: Buton de Finalizare / Reactivare */}
                          {(currentUser?.role === 'admin' || currentUser?.role === 'ADMIN') && (
                            <>
                              <button 
                                onClick={() => handleToggleCampaignStatus(camp.id)}
                                style={{
                                  padding: '10px 14px',
                                  backgroundColor: camp.is_active ? '#6c757d' : '#198754',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '13px'
                                }}
                              >
                                {camp.is_active ? '🏁 Finalizează Campania' : '🔄 Reactivează Campania'}
                              </button>

                              {camp.is_active && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReminderConfirmModal({ isOpen: true, campaign: camp });
                                  }} 
                                  style={{ padding: '10px 15px', backgroundColor: '#2b2d42', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                                  🔔 Reminder
                                </button>
                              )}
                            </>
                          )}

                          {/* USER: Buton Programează-te */}
                          <button 
                            disabled={!camp.is_active}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (camp.is_active) setSelectedCampaign(camp);
                            }} 
                            style={{ 
                              padding: '10px 20px', 
                              backgroundColor: camp.is_active ? '#e63946' : '#ccc', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '4px', 
                              cursor: camp.is_active ? 'pointer' : 'not-allowed', 
                              fontWeight: 'bold', 
                              fontSize: '14px' 
                            }}>
                            {camp.is_active ? 'Programează-te' : 'Încheiată'}
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </main>

              {/* PROGRAMĂRILE MELE (DONATORI) */}
              {currentUser?.role !== 'admin' && currentUser?.role !== 'ADMIN' && (
                <aside style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e1e4e8' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#2b2d42', borderBottom: '2px solid #f1f3f5', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🩸 Programările Mele
                  </h3>
                  
                  {myAppointments.length === 0 ? (
                    <p style={{ color: '#666', fontStyle: 'italic', fontSize: '14px' }}>Nu aveți nicio programare activă rezervată.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {myAppointments.map((app) => (
                        <div key={app.id} style={{ border: '1px solid #f1f3f5', borderRadius: '8px', padding: '16px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', borderLeft: '4px solid #e63946' }}>
                          <h4 style={{ margin: '0 0 10px 0', color: '#2b2d42', fontSize: '16px', fontWeight: 'bold', lineHeight: '1.4' }}>
                            {app.campaign_title || 'Campanie de Donare'}
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#555', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>📅</span> 
                              <span>Data: <strong>{formatDateRo(app.appointment_date || app.campaign_date || '')}</strong></span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>🕒</span> 
                              <span>Ora: <strong style={{ color: '#e63946' }}>{formatTimeShort(app.slot_time)}</strong></span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f8f9fa', paddingTop: '10px' }}>
                            <button 
                              onClick={() => handleCancelClick(app.id)} 
                              style={{ 
                                padding: '6px 12px', 
                                backgroundColor: '#fff', 
                                border: '1px solid #dc3545', 
                                color: '#dc3545', 
                                borderRadius: '4px', 
                                cursor: 'pointer', 
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}
                            >
                              Anulează Rezervarea
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </aside>
              )}

            </div>
          </>
        )}
      </div>

      {/* POP-UP REMINDER CONFIRMATION */}
      {reminderConfirmModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', maxWidth: '450px', width: '90%', boxShadow: '0 4px 25px rgba(0,0,0,0.2)', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>🔔</div>
            <h3 style={{ margin: '0 0 15px 0', color: '#2b2d42' }}>Confirmare Trimitere</h3>
            <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.5', marginBottom: '25px' }}>
              Sigur doriți să trimiteți email-uri de reminder tuturor donatorilor cu programare activă din campania: <br/>
              <strong style={{ color: '#e63946' }}>{reminderConfirmModal.campaign?.title}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setReminderConfirmModal({ isOpen: false, campaign: null })} 
                style={{ padding: '10px 20px', backgroundColor: '#f1f3f5', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                Anulează
              </button>
              <button 
                onClick={executeSendReminders} 
                style={{ padding: '10px 24px', backgroundColor: '#e63946', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                Da, Trimite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP REMINDER RESULT */}
      {reminderResultModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', maxWidth: '420px', width: '90%', boxShadow: '0 4px 25px rgba(0,0,0,0.2)', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: '45px', marginBottom: '15px' }}>
              {reminderResultModal.isSuccess ? '✔️' : '❌'}
            </div>
            <h3 style={{ margin: '0 0 12px 0', color: reminderResultModal.isSuccess ? '#198754' : '#dc3545' }}>
              {reminderResultModal.isSuccess ? 'Operațiune Reușită' : 'Eroare la solicitare'}
            </h3>
            <p style={{ color: '#555', fontSize: '14px', lineHeight: '1.5', marginBottom: '25px' }}>
              {reminderResultModal.message}
            </p>
            <button 
              onClick={() => setReminderResultModal({ isOpen: false, isSuccess: true, message: '' })} 
              style={{ padding: '9px 25px', backgroundColor: '#2b2d42', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
              Închide
            </button>
          </div>
        </div>
      )}

      {showProfileModal && (
        <ProfileModal 
          user={currentUser}
          myAppointments={myAppointments}
          onClose={() => setShowProfileModal(false)}
          onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        />
      )}

      {selectedCampaign && (
        <AppointmentModal 
          campaign={selectedCampaign} 
          eligibilityQuestions={eligibilityQuestions} 
          onClose={() => setSelectedCampaign(null)} 
          onRefresh={fetchData} 
          onOpenWaitlist={(camp) => {
            setSelectedCampaign(null);
            setWaitlistCampaign(camp);
          }}
        />
      )}

      {assignModalData && (
        <AppointmentModal 
          campaign={assignModalData.campaign}
          eligibilityQuestions={eligibilityQuestions} 
          waitlistId={assignModalData.waitlistId}
          isAssigningFromWaitlist={true}
          onClose={() => setAssignModalData(null)} 
          onRefresh={fetchData} 
        />
      )}

      {waitlistCampaign && (
        <WaitlistModal 
          campaign={waitlistCampaign} 
          onClose={() => setWaitlistCampaign(null)} 
          onRefresh={fetchData} 
        />
      )}

      {appointmentToCancel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1500 }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Confirmare Anulare</h4>
            <p style={{ color: '#666', fontSize: '15px', marginBottom: '20px' }}>Sigur doriți anularea definitivă a acestei programări?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setAppointmentToCancel(null)} style={{ padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>Renunță</button>
              <button onClick={executeCancel} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Da, anulează</button>
            </div>
          </div>
        </div>
      )}
      <AIChatbox onSelectCampaign={(campaignId) => {
          const selected = campaigns.find(c => c.id === parseInt(campaignId, 10));
          if (selected && selected.is_active) {
            setSelectedCampaign(selected);
          }
        }} 
      />
    </div>
  );
}

export default Dashboard;