import React, { useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const C = '#B8952A';

const TIME_SLOTS = ['10:00 AM','11:00 AM','12:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'];
const TYPES = [
  { id:'site_visit',  label:'🏠 Site Visit',  desc:'Visit the property in person' },
  { id:'video_call',  label:'📹 Video Call',  desc:'Virtual tour via Google Meet / Zoom' },
  { id:'phone_call',  label:'📞 Phone Call',  desc:'Quick call with sales advisor' },
];

export default function BookingWidget({ onClose, onBooked, leadId, sessionId, propertyName }) {
  const [step, setStep]         = useState(1); // 1=type, 2=date, 3=confirm
  const [type, setType]         = useState('site_visit');
  const [date, setDate]         = useState('');
  const [time, setTime]         = useState('');
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [booked, setBooked]     = useState(false);
  const [error, setError]       = useState('');

  // Generate next 14 available dates (skip Sundays)
  const availDates = [];
  const d = new Date(); d.setDate(d.getDate() + 1);
  while (availDates.length < 14) {
    if (d.getDay() !== 0) availDates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  async function confirmBooking() {
    if (!name.trim() || !phone.trim()) { setError('Please enter your name and phone number.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/booking/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, leadId, type, scheduledDate: date, scheduledTime: time, guestName: name, guestPhone: phone, propertyName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setBooked(true);
      if (onBooked) onBooked({ type, date, time, name, phone });
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  const S = {
    wrap:{ background:'#fff', borderRadius:16, border:'1px solid rgba(0,0,0,0.08)', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.1)', fontFamily:"'Outfit',sans-serif", width:'100%', maxWidth:380 },
    hdr: { background:`linear-gradient(135deg,${C},#F0CC6A)`, padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' },
    body:{ padding:'16px 18px' },
    closeBtn:{ background:'rgba(255,255,255,0.3)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' },
    btn: { width:'100%', padding:'12px', borderRadius:100, border:'none', background:`linear-gradient(135deg,${C},#F0CC6A)`, color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit', marginTop:8 },
    inp: { width:'100%', padding:'9px 12px', borderRadius:9, border:'1.5px solid rgba(0,0,0,0.1)', fontSize:13, fontFamily:'inherit', color:'#1A1A22', outline:'none', marginBottom:10, boxSizing:'border-box' },
  };

  if (booked) return (
    <div style={S.wrap}>
      <div style={S.hdr}>
        <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>📅 Site Visit Booking</div>
        <button style={S.closeBtn} onClick={onClose}>×</button>
      </div>
      <div style={{ ...S.body, textAlign:'center', paddingTop:24 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:800, color:'#1A1A22', marginBottom:8 }}>Booking Confirmed!</div>
        <div style={{ fontSize:13, color:'#4A4A5A', lineHeight:1.7, marginBottom:16 }}>
          Your {TYPES.find(t=>t.id===type)?.label.replace(/🏠|📹|📞\s/g,'').trim()} is scheduled for<br/>
          <strong>{date} at {time}</strong><br/>
          Our team will call {phone} to confirm.
        </div>
        <div style={{ padding:'10px 14px', background:'rgba(42,173,106,0.08)', borderRadius:9, border:'1px solid rgba(42,173,106,0.2)', fontSize:12, color:'#2AAD6A' }}>
          ✅ Confirmation SMS sent to {phone}
        </div>
        <button style={{ ...S.btn, marginTop:16 }} onClick={onClose}>Done</button>
      </div>
    </div>
  );

  return (
    <div style={S.wrap}>
      <div style={S.hdr}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>📅 Book a Visit</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:11 }}>{propertyName || 'Site Visit'} · Step {step} of 3</div>
        </div>
        <button style={S.closeBtn} onClick={onClose}>×</button>
      </div>

      {/* Progress */}
      <div style={{ display:'flex', gap:4, padding:'10px 18px 0' }}>
        {[1,2,3].map(s => <div key={s} style={{ flex:1, height:3, borderRadius:3, background: s<=step?C:'#F0EEE8', transition:'all 0.3s' }}/>)}
      </div>

      <div style={S.body}>
        {/* Step 1: Visit type */}
        {step === 1 && (
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#1A1A22', marginBottom:12 }}>What kind of visit?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {TYPES.map(t => (
                <div key={t.id} onClick={() => setType(t.id)}
                  style={{ padding:'12px 14px', borderRadius:10, border:`1.5px solid ${type===t.id?C:'rgba(0,0,0,0.1)'}`, background:type===t.id?'rgba(184,149,42,0.06)':'#fff', cursor:'pointer', transition:'all 0.15s' }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{t.label}</div>
                  <div style={{ fontSize:11, color:'#7A7A8A', marginTop:2 }}>{t.desc}</div>
                </div>
              ))}
            </div>
            <button style={S.btn} onClick={() => setStep(2)}>Choose Date & Time →</button>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#1A1A22', marginBottom:10 }}>Select Date</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:14 }}>
              {availDates.slice(0,8).map((d,i) => {
                const dateStr = d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
                const dayStr  = d.toLocaleDateString('en-IN', { weekday:'short' });
                return (
                  <div key={i} onClick={() => setDate(d.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }))}
                    style={{ padding:'8px 4px', borderRadius:9, border:`1.5px solid ${date.includes(d.getDate()+' ')?C:'rgba(0,0,0,0.1)'}`, background:date.includes(d.getDate()+' ')?'rgba(184,149,42,0.08)':'#fff', cursor:'pointer', textAlign:'center', transition:'all 0.15s' }}>
                    <div style={{ fontSize:10, color:'#7A7A8A' }}>{dayStr}</div>
                    <div style={{ fontSize:13, fontWeight:600, color: date.includes(d.getDate()+' ')?C:'#1A1A22' }}>{dateStr}</div>
                  </div>
                );
              })}
            </div>
            {date && (
              <>
                <div style={{ fontSize:13, fontWeight:600, color:'#1A1A22', marginBottom:8 }}>Select Time</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                  {TIME_SLOTS.map(t => (
                    <button key={t} onClick={() => setTime(t)}
                      style={{ padding:'7px 12px', borderRadius:8, border:`1.5px solid ${time===t?C:'rgba(0,0,0,0.1)'}`, background:time===t?'rgba(184,149,42,0.08)':'#fff', color:time===t?C:'#4A4A5A', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:time===t?600:400 }}>
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setStep(1)} style={{ flex:0.4, padding:'11px', borderRadius:100, border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#4A4A5A', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
              <button style={{ flex:1, ...S.btn, marginTop:0 }} onClick={() => { if (date && time) setStep(3); }} disabled={!date||!time}>Confirm Date →</button>
            </div>
          </div>
        )}

        {/* Step 3: Contact */}
        {step === 3 && (
          <div>
            <div style={{ padding:'10px 12px', background:'rgba(184,149,42,0.08)', borderRadius:9, border:'1px solid rgba(184,149,42,0.2)', marginBottom:14, fontSize:12 }}>
              <div style={{ fontWeight:600, color:C }}>📅 {date}</div>
              <div style={{ color:'#4A4A5A', marginTop:2 }}>🕐 {time} · {TYPES.find(t=>t.id===type)?.label}</div>
            </div>
            <label style={{ fontSize:11, fontWeight:600, color:'#7A7A8A', marginBottom:4, display:'block' }}>YOUR NAME *</label>
            <input style={S.inp} value={name} onChange={e => setName(e.target.value)} placeholder="Ravi Kumar" onFocus={e=>e.target.style.borderColor=C} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.1)'}/>
            <label style={{ fontSize:11, fontWeight:600, color:'#7A7A8A', marginBottom:4, display:'block' }}>PHONE NUMBER *</label>
            <input style={S.inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" onFocus={e=>e.target.style.borderColor=C} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,0.1)'}/>
            {error && <div style={{ color:'#E24B4A', fontSize:12, marginBottom:8 }}>⚠️ {error}</div>}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setStep(2)} style={{ flex:0.4, padding:'11px', borderRadius:100, border:'1px solid rgba(0,0,0,0.12)', background:'#fff', color:'#4A4A5A', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
              <button style={{ flex:1, ...S.btn, marginTop:0, opacity:loading?0.7:1 }} onClick={confirmBooking} disabled={loading}>
                {loading ? 'Booking...' : '✅ Confirm Booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}