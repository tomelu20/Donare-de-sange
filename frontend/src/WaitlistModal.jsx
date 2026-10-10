import React, { useState } from 'react';
import axios from 'axios';

function WaitlistModal({ campaign, onClose, onRefresh }) {
  const [isOpen, setIsOpen] = useState(true);

  const savedUser = sessionStorage.getItem('user_session');
  const user = savedUser ? JSON.parse(savedUser) : null;

  if (!isOpen || !campaign || !user) return null;

  // Generăm toate zilele campaniei
  const campaignDays = [];
  if (campaign) {
    let startDateStr = campaign.date || campaign.start_date;
    let endDateStr = campaign.end_date || campaign.date;

    if (startDateStr) {
      let curr = new Date(startDateStr);
      let end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);
      
      while (curr <= end) {
        campaignDays.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }
    }
  }

  if (campaignDays.length === 0 && campaign?.date) {
    campaignDays.push(campaign.date);
  }

  // Funcție de formatare a datei în zi.luna.an
  const formatDateRO = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateString;
  };

  const [selectedDate, setSelectedDate] = useState(campaignDays[0] || '');
  
  // Determinăm ora maximă de sfârșit a campaniei (fallback la 13:00)
  const campaignEndTime = campaign?.end_time || campaign?.closing_time || '13:00';
  
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState(campaignEndTime);

  const [travelTime, setTravelTime] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsOpen(false);
    // Dacă funcția onClose este transmisă din componenta părinte pentru demontare:
    if (onClose) onClose();
  };

  // Generăm lista completă de ore (până la ora de sfârșit a campaniei)
  const generateHourOptions = (maxTimeStr) => {
    let options = [];
    let [maxH, maxM] = maxTimeStr ? maxTimeStr.split(':').map(Number) : [13, 0];

    for (let hour = 8; hour <= maxH; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        if (hour === maxH && minute > maxM) break;
        let formattedHour = hour.toString().padStart(2, '0');
        let formattedMinute = minute.toString().padStart(2, '0');
        let timeStr = `${formattedHour}:${formattedMinute}`;
        options.push(timeStr);
      }
    }
    return options;
  };

  const allHourOptions = generateHourOptions(campaignEndTime);

  // Ora minimă trebuie să fie cu cel puțin 15 minute înainte de ora maximă selectată
  const getStartTimeOptions = () => {
    return allHourOptions.filter(time => {
      const [h1, m1] = time.split(':').map(Number);
      const [h2, m2] = endTime.split(':').map(Number);
      const totalMinutes1 = h1 * 60 + m1;
      const totalMinutes2 = h2 * 60 + m2;
      return totalMinutes1 <= totalMinutes2 - 15;
    });
  };

  // Ora maximă trebuie să fie cu cel puțin 15 minute după ora minimă selectată
  const getEndTimeOptions = () => {
    return allHourOptions.filter(time => {
      const [h1, m1] = startTime.split(':').map(Number);
      const [h2, m2] = time.split(':').map(Number);
      const totalMinutes1 = h1 * 60 + m1;
      const totalMinutes2 = h2 * 60 + m2;
      return totalMinutes2 >= totalMinutes1 + 15;
    });
  };

  const startTimeOptions = getStartTimeOptions();
  const endTimeOptions = getEndTimeOptions();

  // Gestionare schimbare ora maximă cu validare automată a orei minime
  const handleEndTimeChange = (newEndTime) => {
    setEndTime(newEndTime);
    const [h1, m1] = startTime.split(':').map(Number);
    const [h2, m2] = newEndTime.split(':').map(Number);
    if ((h1 * 60 + m1) >= (h2 * 60 + m2) - 15) {
      let totalMin = (h2 * 60 + m2) - 15;
      let newH = Math.floor(totalMin / 60).toString().padStart(2, '0');
      let newM = (totalMin % 60).toString().padStart(2, '0');
      setStartTime(`${newH}:${newM}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    let combinedTime = `Data: ${formatDateRO(selectedDate)} | Interval: de la ${startTime} până la ${endTime}`;
    
    const token = 
      sessionStorage.getItem('token') || 
      sessionStorage.getItem('access_token') ||
      sessionStorage.getItem('jwt') ||
      localStorage.getItem('token') || 
      localStorage.getItem('access_token') ||
      user?.token || 
      user?.access_token || 
      user?.jwt ||
      (savedUser ? JSON.parse(savedUser)?.token || JSON.parse(savedUser)?.access_token : null);

    try {
      await axios.post('http://127.0.0.1:8000/waitlist/', {
        campaign_id: campaign.id,
        preferred_time_range: combinedTime,
        travel_time_minutes: parseInt(travelTime)
      }, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });

      setSuccess('Te-ai înscris cu succes în lista de așteptare!');
      if (onRefresh) onRefresh();
      setTimeout(() => {
        setIsOpen(false);
        if (onClose) onClose();
      }, 2000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      let errorMsg = 'Eroare la înscrierea în lista de așteptare.';
      
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map(d => d.msg || JSON.stringify(d)).join('; ');
      } else if (typeof detail === 'object' && detail !== null) {
        errorMsg = JSON.stringify(detail);
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', maxWidth: '480px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', fontFamily: 'sans-serif' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#e63946' }}>Înscriere Waitlist</h3>
          {/* Verificat: are type="button" și apelează handleClose */}
          <button type="button" onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>&times;</button>
        </div>

        {error && <p style={{ color: 'red', backgroundColor: '#ffe3e3', padding: '10px', borderRadius: '4px', fontSize: '14px' }}>{error}</p>}
        {success && (
          <div>
            <p style={{ color: 'green', backgroundColor: '#e3ffe3', padding: '10px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>{success}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
              {/* Adăugat type="button" explicit și apelarea corectă a lui handleClose */}
              <button 
                type="button" 
                onClick={handleClose} 
                style={{ padding: '8px 15px', backgroundColor: '#2b2d42', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Închide
              </button>
            </div>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#555', lineHeight: '1.4' }}>
              Dacă nu găsești un interval disponibil pentru campania de la <strong>{campaign.location_name}</strong>, alege ziua și perioada orară în care poți veni.
            </p>

            {/* SELECȚIE DATĂ ÎN FORMAT ZI.LUNĂ.AN */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>Alege ziua campaniei:</label>
              <select 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                required 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#fff' }}
              >
                {campaignDays.map((day, index) => (
                  <option key={index} value={day}>
                    Ziua {index + 1}: {formatDateRO(day)}
                  </option>
                ))}
              </select>
              <small style={{ color: '#666', fontSize: '11px', marginTop: '2px', display: 'block' }}>
                Poți selecta oricare dintre zilele în care se desfășoară campania.
              </small>
            </div>

            {/* CADRANELE DE ORE VALIDATE RECIPROC */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>Cel mai devreme de la:</label>
                <select 
                  value={startTime} 
                  onChange={(e) => setStartTime(e.target.value)} 
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  {startTimeOptions.map((time, idx) => (
                    <option key={idx} value={time}>{time}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>Cel târziu până la:</label>
                <select 
                  value={endTime} 
                  onChange={(e) => handleEndTimeChange(e.target.value)} 
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', backgroundColor: '#fff' }}
                >
                  {endTimeOptions.map((time, idx) => (
                    <option key={idx} value={time}>{time}</option>
                  ))}
                </select>
              </div>
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
                onClick={handleClose} 
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