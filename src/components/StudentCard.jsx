import React from 'react';

export default function StudentCard({ student, parent, className, sectionName }) {
  if (!student) return null;

  // Format date helper (YYYY-MM-DD to DD-MM-YYYY)
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return '-';
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let years = today.getFullYear() - birthDate.getFullYear();
      let months = today.getMonth() - birthDate.getMonth();
      if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
      }
      if (today.getDate() < birthDate.getDate()) {
        months--;
        if (months < 0) {
          months += 12;
        }
      }
      return `${years}Y ${months}M`;
    } catch {
      return '-';
    }
  };

  const cardStyle = {
    width: '400px',
    height: '280px',
    background: '#f8f8f8',
    borderRadius: '8px',
    boxShadow: '0 0 10px rgba(0,0,0,0.3)',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Arial', sans-serif",
    border: '2px solid #ccc',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle = {
    height: '75px',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    padding: '8px 15px',
    zIndex: 1,
  };

  const svgBg = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  };

  const schoolInfo = {
    marginLeft: '60px', // space for logo
    flex: 1,
    paddingTop: '5px',
  };

  const schoolName = {
    fontSize: '18px',
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    margin: 0,
    letterSpacing: '0.5px',
  };

  const cardTitle = {
    fontSize: '12px',
    color: '#ed6c3c',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    margin: 0,
    marginTop: '2px',
    letterSpacing: '1px',
    textAlign: 'center',
    paddingRight: '40px',
  };

  const bodyStyle = {
    display: 'flex',
    flex: 1,
    padding: '5px 15px 10px',
  };

  const detailsContainer = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  };

  const studentNameStyle = {
    fontSize: '20px',
    fontWeight: '900',
    color: '#385387',
    marginBottom: '8px',
    textTransform: 'uppercase',
    marginTop: '5px',
  };

  const photoContainer = {
    width: '85px',
    marginLeft: '15px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: '10px',
  };

  const photoFrame = {
    width: '80px',
    height: '100px',
    borderRadius: '4px',
    border: '2px solid #333',
    overflow: 'hidden',
    background: '#4da6ff', // Default blue bg like the image
  };

  const signText = {
    fontSize: '10px',
    color: '#333',
    marginTop: 'auto',
    marginBottom: '5px',
    fontWeight: 'bold',
  };

  const footerStyle = {
    height: '24px',
    background: '#ffffff',
    color: '#1a237e',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    borderTop: '2px solid #5a76a8',
  };

  const FieldRow = ({ label, value, fullWidth }) => (
    <div style={{
      display: 'flex',
      border: '1px solid #28a745', // Match green theme
      borderRadius: '6px',
      height: '22px',
      alignItems: 'center',
      marginBottom: '4px',
      width: fullWidth ? '100%' : '49%',
      background: 'white',
      overflow: 'hidden'
    }}>
      <div style={{
        background: '#28a745', // Green background
        color: '#800000',      // Maroon text
        height: '100%',
        padding: '0 8px',
        fontSize: '10px',
        fontWeight: '900',     // Extra bold for visibility
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0
      }}>
        {label}
      </div>
      <div style={{
        flex: 1,
        padding: '0 6px',      // Data starts immediately next to label
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#0d47a1',      // Blue text for data
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {value}
      </div>
    </div>
  );
  return (
    <div style={cardStyle} className="id-card-component">
      {/* Header with SVG curves */}
      <div style={headerStyle}>
        <svg style={svgBg} viewBox="0 0 400 75" preserveAspectRatio="none">
          {/* Grey shadow curve */}
          <path d="M0,0 L400,0 L400,65 Q200,85 0,55 Z" fill="#b0b5c0" />
          {/* Blue main curve */}
          <path d="M0,0 L400,0 L400,55 Q200,75 0,45 Z" fill="#5a76a8" />
        </svg>

        {/* Logo placed over the curve */}
        <div style={{
          position: 'absolute',
          left: '10px',
          top: '5px',
          width: '60px',
          height: '60px',
          background: 'white',
          borderRadius: '50%',
          border: '2px solid #ed6c3c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          <img src="/logo.png" alt="Logo" style={{ width: '90%', height: '90%', objectFit: 'contain' }} />
        </div>

        <div style={schoolInfo}>
          <h1 style={schoolName}>Oxford Grammar School</h1>
          <p style={cardTitle}>Student Card</p>
        </div>
      </div>

      <div style={bodyStyle}>
        <div style={detailsContainer}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '4px', marginTop: '5px' }}>
            <h2 style={{ ...studentNameStyle, margin: 0 }}>{student.name}</h2>
            <div style={{ fontSize: '13px', color: '#385387', fontWeight: 'bold', paddingBottom: '2px', marginRight: '5px' }}>
              ID: {student.id} | Admission No: {student.roll_no || '-'}
            </div>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' }}>
            <FieldRow label="F/Name" value={parent?.father_name || '-'} fullWidth />
            <FieldRow label="F/Cont." value={parent?.father_contact || '-'} fullWidth />
            <FieldRow label="Class" value={className || '-'} />
            <FieldRow label="Section" value={sectionName || '-'} />
            <FieldRow label="DOB" value={formatDate(student.dob)} fullWidth />
          </div>
        </div>

        <div style={photoContainer}>
          <div style={photoFrame}>
            {student.picture ? (
              <img src={student.picture} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                 No Image
              </div>
            )}
          </div>
          <div style={signText}>
            Principal Sign:
          </div>
        </div>
      </div>

      <div style={footerStyle}>
        Chak No. 202/RB, Gatti Faisalabad | Ph: 0321-6088202
      </div>
    </div>
  );
}
