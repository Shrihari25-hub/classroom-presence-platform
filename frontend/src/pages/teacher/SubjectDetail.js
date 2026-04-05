import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/shared/Sidebar';
import {
  getSubject, getSessionsBySubject, startSession, endSession,
  getSubjectStudents, exportAttendance, markAttendanceManual,
  getSubjectEmbeddings, getSessionAttendance
} from '../../services/api';
import { QRCodeSVG } from 'qrcode.react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

// ─── Face helpers ─────────────────────────────────────────────────────────────

function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

function findBestMatch(queryEmbedding, studentEmbeddings, threshold = 0.55) {
  let best = null;
  let bestDist = Infinity;
  for (const student of studentEmbeddings) {
    if (!student.faceRegistered || !student.embeddings?.length) continue;
    for (const storedEmb of student.embeddings) {
      const dist = euclideanDistance(queryEmbedding, storedEmb);
      if (dist < bestDist) { bestDist = dist; best = student; }
    }
  }
  if (!best || bestDist > threshold) return null;
  const confidence = Math.max(0, Math.min(1, 1 - bestDist / threshold));
  return { studentId: best.studentId, name: best.name, confidence };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubjectDetail() {
  const { subjectId } = useParams();
  const navigate = useNavigate();

  const [subject, setSubject] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMode, setSessionMode] = useState('face');
  const [manualStatus, setManualStatus] = useState('present');
  const [markedIds, setMarkedIds] = useState(new Set());

  // Face recognition state
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [studentEmbeddings, setStudentEmbeddings] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [continuousScan, setContinuousScan] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const webcamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Load face-api models once
  useEffect(() => {
    const loadModels = async () => {
      setModelsLoading(true);
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.warn('face-api.js models failed:', err.message);
      } finally {
        setModelsLoading(false);
      }
    };
    loadModels();
    return () => { if (scanIntervalRef.current) clearInterval(scanIntervalRef.current); };
  }, []);

  const loadMarkedStudents = async (sessionId) => {
    try {
      const res = await getSessionAttendance(sessionId);
      setMarkedIds(new Set(res.data.map(r => r.student?._id)));
    } catch (_) {}
  };

  const fetchData = async () => {
    try {
      const [sub, sess, studs] = await Promise.all([
        getSubject(subjectId),
        getSessionsBySubject(subjectId),
        getSubjectStudents(subjectId),
      ]);
      setSubject(sub.data);
      setSessions(sess.data);   // Now includes presentCount, absentCount, attendancePercentage
      setStudents(studs.data);
      const active = sess.data.find(s => s.status === 'active') || null;
      setActiveSession(active);
      if (active) loadMarkedStudents(active._id);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [subjectId]); // eslint-disable-line

  useEffect(() => {
    if (activeSession?.mode === 'face') {
      getSubjectEmbeddings(subjectId)
        .then(res => setStudentEmbeddings(res.data))
        .catch(console.error);
    }
    if (activeSession?.mode === 'qr') {
      const interval = setInterval(() => loadMarkedStudents(activeSession._id), 5000);
      return () => clearInterval(interval);
    }
  }, [activeSession, subjectId]); // eslint-disable-line

  const handleStartSession = async () => {
    try { await startSession({ subjectId, mode: sessionMode }); setScanResult(null); fetchData(); }
    catch (err) { alert(err.response?.data?.message || 'Error starting session'); }
  };

  const handleEndSession = async () => {
    if (!window.confirm('End this session?')) return;
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    setContinuousScan(false);
    try { await endSession(activeSession._id); setMarkedIds(new Set()); fetchData(); }
    catch (err) { alert(err.response?.data?.message || 'Error ending session'); }
  };

  const handleManualMark = async (studentId, statusOverride) => {
    try {
      await markAttendanceManual({
        sessionId: activeSession._id,
        studentId,
        status: statusOverride || manualStatus
        // No overrideNote here — pure manual mark, so method stays 'manual'
      });
      setMarkedIds(prev => new Set([...prev, studentId]));
    } catch (err) { alert(err.response?.data?.message || 'Error marking attendance'); }
  };

  // FIX 1: Face scan — pass confidence via overrideNote so backend saves it correctly
  const captureAndRecognize = useCallback(async () => {
    if (!modelsLoaded || !webcamRef.current || scanning) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;
    setScanning(true);
    setScanResult(null);
    try {
      const img = await faceapi.fetchImage(imageSrc);
      const detections = await faceapi
        .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setScanResult({ status: 'no_face', message: 'No face detected — adjust camera or lighting.' });
        setScanning(false);
        return;
      }

      const results = [];
      for (const detection of detections) {
        const queryEmbedding = Array.from(detection.descriptor);
        const match = findBestMatch(queryEmbedding, studentEmbeddings);
        if (!match) {
          results.push({ status: 'unknown', message: 'Unknown face — not in student list' });
          continue;
        }
        if (markedIds.has(match.studentId)) {
          results.push({ status: 'duplicate', message: `${match.name} already marked` });
          continue;
        }

        const confidencePct = (match.confidence * 100).toFixed(1);

        // FIX 1: overrideNote carries "Face recognition — X% confidence"
        // The updated attendanceController reads this to set method='face' and confidenceScore
        await markAttendanceManual({
          sessionId: activeSession._id,
          studentId: match.studentId,
          status: 'present',
          overrideNote: `Face recognition — ${confidencePct}% confidence`
        });

        setMarkedIds(prev => new Set([...prev, match.studentId]));
        results.push({
          status: 'matched',
          name: match.name,
          message: `✓ ${match.name} — ${confidencePct}% match`
        });
      }
      setScanResult({ results, faceCount: detections.length });
    } catch (err) {
      setScanResult({ status: 'error', message: err.message });
    } finally {
      setScanning(false);
    }
  }, [modelsLoaded, scanning, studentEmbeddings, markedIds, activeSession]); // eslint-disable-line

  const toggleContinuousScan = () => {
    if (continuousScan) {
      setContinuousScan(false);
      if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    } else {
      setContinuousScan(true);
      scanIntervalRef.current = setInterval(captureAndRecognize, 2500);
    }
  };

  if (loading) return (
    <div className="app"><Sidebar /><div className="main-content"><div className="spinner" /></div></div>
  );

  const notYetMarked = students.filter(e => !markedIds.has(e.student?._id));
  const alreadyMarked = students.filter(e => markedIds.has(e.student?._id));

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1>📖 {subject?.subjectName}</h1>
            <div style={{ color: '#888', fontSize: 14 }}>
              {subject?.subjectCode && <span>{subject.subjectCode} • </span>}
              Course: {subject?.course?.courseName}
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => exportAttendance(subjectId)}>
            📥 Export Attendance
          </button>
        </div>

        {/* ── SESSION CARD ── */}
        <div className="card">
          <div className="card-title">🎯 Attendance Session</div>

          {activeSession ? (
            <div>
              {/* Status bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 16 }}>● LIVE</span>
                <span style={{ fontSize: 14, color: '#888' }}>
                  Started: {new Date(activeSession.startTime).toLocaleTimeString()} •
                  Auto-ends: {new Date(activeSession.scheduledEnd).toLocaleTimeString()}
                </span>
                <span className="badge badge-info">{activeSession.mode.toUpperCase()}</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: '#22c55e', fontWeight: 600 }}>
                  {markedIds.size}/{students.length} marked
                </span>
              </div>
              <div className="actions-row" style={{ marginBottom: 24 }}>
                <button className="btn btn-danger" onClick={handleEndSession}>⏹ End Session</button>
                <button className="btn btn-outline" onClick={() => navigate(`/teacher/session/${activeSession._id}`)}>
                  👁 View Attendance
                </button>
              </div>

              {/* ── FACE MODE ── */}
              {activeSession.mode === 'face' && (
                <div>
                  <h3 style={{ marginBottom: 12, fontSize: 16 }}>📷 Face Recognition</h3>
                  {modelsLoading && (
                    <div className="alert" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                      ⏳ Loading face recognition models…
                    </div>
                  )}
                  {!modelsLoaded && !modelsLoading && (
                    <div className="alert alert-error">
                      ⚠️ Face models not loaded. Place files from{' '}
                      <a href="https://github.com/justadudewhohacks/face-api.js/tree/master/weights"
                        target="_blank" rel="noopener noreferrer">
                        face-api.js GitHub
                      </a>{' '}into <code>public/models/</code>
                    </div>
                  )}
                  {modelsLoaded && (
                    <div className="face-scan-wrapper" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      {/* Camera */}
                      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <Webcam
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            style={{ width: '100%', maxWidth: 420, aspectRatio: '4 / 3', height: 'auto', borderRadius: 12, display: 'block' }}
                            videoConstraints={{ facingMode }}
                          />
                          {continuousScan && (
                            <div style={{
                              position: 'absolute', top: 8, right: 8,
                              background: 'rgba(34,197,94,0.9)', color: '#fff',
                              borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700
                            }}>
                              🔴 SCANNING
                            </div>
                          )}
                        </div>
                        <div className="actions-row" style={{ marginTop: 12 }}>
                          <button className="btn btn-primary" onClick={captureAndRecognize} disabled={scanning || continuousScan}>
                            {scanning ? '⏳ Scanning…' : '📸 Scan Once'}
                          </button>
                          <button
                            className={`btn ${continuousScan ? 'btn-danger' : 'btn-success'}`}
                            onClick={toggleContinuousScan}
                            disabled={scanning}
                          >
                            {continuousScan ? '⏹ Stop Auto-Scan' : '▶ Auto-Scan'}
                          </button>
                          <button
                            className="btn btn-outline"
                            onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                            title="Switch camera"
                            disabled={continuousScan}
                          >
                            🔄
                          </button>
                        </div>
                        <p style={{ fontSize: 12, color: '#888', marginTop: 8, maxWidth: 420 }}>
                          Auto-scan detects faces every 2.5 s.
                        </p>
                      </div>

                      {/* Results panel */}
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Live Results</div>
                        {scanResult && (
                          <div style={{ marginBottom: 12 }}>
                            {scanResult.status === 'no_face' && (
                              <div className="alert alert-error" style={{ padding: '8px 12px', fontSize: 13 }}>
                                {scanResult.message}
                              </div>
                            )}
                            {scanResult.status === 'error' && (
                              <div className="alert alert-error" style={{ padding: '8px 12px', fontSize: 13 }}>
                                Error: {scanResult.message}
                              </div>
                            )}
                            {scanResult.results?.map((r, i) => (
                              <div key={i} style={{
                                padding: '7px 12px', borderRadius: 8, marginBottom: 6, fontSize: 13,
                                background: r.status === 'matched' ? '#dcfce7' : r.status === 'duplicate' ? '#fef9c3' : '#fee2e2',
                                color: r.status === 'matched' ? '#15803d' : r.status === 'duplicate' ? '#92400e' : '#b91c1c'
                              }}>
                                {r.message}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginBottom: 6 }}>
                          Pending ({notYetMarked.length})
                        </div>
                        {notYetMarked.map(e => (
                          <div key={e._id} style={{
                            display: 'flex', justifyContent: 'space-between',
                            padding: '4px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13
                          }}>
                            <span>{e.student?.name}</span>
                            <span className={`badge ${e.student?.faceRegistered ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                              {e.student?.faceRegistered ? 'Face ✓' : 'No face'}
                            </span>
                          </div>
                        ))}
                        {alreadyMarked.length > 0 && (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', marginTop: 12, marginBottom: 6 }}>
                              Marked ({alreadyMarked.length})
                            </div>
                            {alreadyMarked.map(e => (
                              <div key={e._id} style={{ fontSize: 13, color: '#22c55e', padding: '3px 0' }}>
                                ✓ {e.student?.name}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Manual override always visible in face mode */}
                  <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Manual Override</div>
                    <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
                      For students whose face could not be detected.
                    </p>
                    <div className="actions-row" style={{ marginBottom: 10 }}>
                      {['present', 'absent', 'late'].map(s => (
                        <button
                          key={s}
                          className={`btn btn-sm ${manualStatus === s ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setManualStatus(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>Student</th><th>Email</th><th>Face</th><th>Status</th><th>Mark</th></tr>
                        </thead>
                        <tbody>
                          {students.map(e => (
                            <tr key={e._id} style={{ opacity: markedIds.has(e.student?._id) ? 0.5 : 1 }}>
                              <td>{e.student?.name}</td>
                              <td style={{ fontSize: 12 }}>{e.student?.email}</td>
                              <td>
                                <span className={`badge ${e.student?.faceRegistered ? 'badge-success' : 'badge-warning'}`}>
                                  {e.student?.faceRegistered ? '✓' : '✗'}
                                </span>
                              </td>
                              <td>
                                {markedIds.has(e.student?._id)
                                  ? <span className="badge badge-success">Marked ✓</span>
                                  : <span className="badge badge-warning">Pending</span>}
                              </td>
                              <td>
                                <button className="btn btn-sm btn-outline" onClick={() => handleManualMark(e.student._id)}>
                                  Mark {manualStatus}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── QR MODE ── */}
              {activeSession.mode === 'qr' && (
                <div>
                  <h3 style={{ marginBottom: 16, fontSize: 16 }}>📱 QR Code Attendance</h3>
                  <div className="qr-section-wrapper" style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ background: '#fff', border: '3px solid #4facfe', borderRadius: 16, padding: 20, display: 'inline-block' }}>
                        <QRCodeSVG value={activeSession.qrCode} size={220} />
                      </div>
                      
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                        Progress ({markedIds.size}/{students.length})
                      </div>
                      {students.map(e => (
                        <div key={e._id} style={{
                          display: 'flex', justifyContent: 'space-between',
                          padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13
                        }}>
                          <span>{e.student?.name}</span>
                          {markedIds.has(e.student?._id)
                            ? <span className="badge badge-success">Scanned ✓</span>
                            : <span className="badge badge-warning">Waiting</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Manual override for QR mode */}
                  <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Manual Override (for students who can't scan)</div>
                    <div className="actions-row" style={{ marginBottom: 10 }}>
                      {['present', 'absent', 'late'].map(s => (
                        <button key={s} className={`btn btn-sm ${manualStatus === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setManualStatus(s)}>{s}</button>
                      ))}
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Student</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>
                          {students.map(e => (
                            <tr key={e._id}>
                              <td>{e.student?.name}</td>
                              <td>{markedIds.has(e.student?._id) ? <span className="badge badge-success">Marked</span> : <span className="badge badge-warning">Pending</span>}</td>
                              <td><button className="btn btn-sm btn-outline" onClick={() => handleManualMark(e.student._id)}>Mark {manualStatus}</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── MANUAL ONLY MODE ── */}
              {activeSession.mode === 'manual' && (
                <div>
                  <h3 style={{ marginBottom: 12, fontSize: 16 }}>✍️ Manual Attendance</h3>
                  <div className="actions-row" style={{ marginBottom: 12 }}>
                    {['present', 'absent', 'late'].map(s => (
                      <button key={s} className={`btn btn-sm ${manualStatus === s ? 'btn-primary' : 'btn-outline'}`} onClick={() => setManualStatus(s)}>{s}</button>
                    ))}
                    <button className="btn btn-success btn-sm" onClick={() => students.forEach(e => {
                      if (!markedIds.has(e.student?._id)) handleManualMark(e.student._id, 'present');
                    })}>
                      ✓ Mark All Present
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Student</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>
                        {students.map(e => (
                          <tr key={e._id}>
                            <td>{e.student?.name}</td>
                            <td style={{ fontSize: 12 }}>{e.student?.email}</td>
                            <td>{markedIds.has(e.student?._id) ? <span className="badge badge-success">Marked ✓</span> : <span className="badge badge-warning">Pending</span>}</td>
                            <td><button className="btn btn-sm btn-outline" onClick={() => handleManualMark(e.student._id)}>Mark {manualStatus}</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          ) : (
            /* ── NO ACTIVE SESSION ── */
            <div>
              <p style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>
                No active session. Start one to begin marking attendance.
              </p>
              <div className="inline-form">
                <select
                  value={sessionMode}
                  onChange={e => setSessionMode(e.target.value)}
                  style={{ flex: 1, minWidth: 220, padding: '9px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
                >
                  <option value="face">📷 Face Recognition</option>
                  <option value="qr">📱 QR Code Scan</option>
                  <option value="manual">✍️ Manual Only</option>
                </select>
                <button className="btn btn-primary" onClick={handleStartSession}>▶ Start Session</button>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: '#888' }}>
                {/* <strong>Face:</strong> Camera auto-detects and marks students. &nbsp;
                <strong>QR:</strong> Students scan QR with their phone. &nbsp;
                <strong>Manual:</strong> Mark by hand. */}
              </div>
            </div>
          )}
        </div>

        {/* ── SESSION HISTORY — FIX 2: enriched columns ── */}
        <div className="card">
          <div className="card-title">📋 Session History</div>
          {sessions.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>No sessions yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Mode</th>
                    {/* FIX 2: New columns */}
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Attendance %</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s._id}>
                      <td>{new Date(s.startTime).toLocaleDateString()}</td>
                      <td>{new Date(s.startTime).toLocaleTimeString()}</td>
                      <td>{s.endTime ? new Date(s.endTime).toLocaleTimeString() : '—'}</td>
                      <td><span className="badge badge-info">{s.mode}</span></td>
                      {/* FIX 2: Show stats returned by updated API */}
                      <td style={{ color: '#15803d', fontWeight: 600 }}>
                        {s.presentCount ?? '—'}
                      </td>
                      <td style={{ color: s.absentCount > 0 ? '#b91c1c' : '#555' }}>
                        {s.absentCount ?? '—'}
                      </td>
                      <td>
                        {s.attendancePercentage !== undefined ? (
                          <span style={{
                            fontWeight: 600,
                            color: s.attendancePercentage >= 75 ? '#15803d' : s.attendancePercentage >= 50 ? '#b45309' : '#b91c1c'
                          }}>
                            {s.attendancePercentage}%
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/teacher/session/${s._id}`)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
