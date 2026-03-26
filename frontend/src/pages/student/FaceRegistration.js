import React, { useEffect, useState, useRef } from 'react';
import Sidebar from '../../components/shared/Sidebar';
import { saveFaceEmbeddings, getMe } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

export default function FaceRegistration() {
  const { user } = useAuth();
  const webcamRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [captures, setCaptures] = useState([]); // array of embedding arrays
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [registered, setRegistered] = useState(user?.faceRegistered);
  const [facingMode, setFacingMode] = useState('environment');

  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setModelsLoaded(true);
      } catch (err) {
        setError('Failed to load face recognition models. Ensure /public/models has the model files from face-api.js.');
      }
    };
    loadModels();
  }, []);

  const captureEmbedding = async () => {
    if (!modelsLoaded) { setError('Models not loaded yet'); return; }
    if (!webcamRef.current) return;
    setCapturing(true);
    setError('');

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      const img = await faceapi.fetchImage(imageSrc);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

      if (!detection) {
        setError('No face detected. Please center your face and ensure good lighting.');
        setCapturing(false);
        return;
      }

      const embedding = Array.from(detection.descriptor);
      setCaptures(prev => {
        const next = [...prev, embedding];
        if (next.length === 3) {
          handleSave(next);
        }
        return next;
      });
    } catch (err) {
      setError('Error capturing face: ' + err.message);
    } finally {
      setCapturing(false);
    }
  };

  const handleSave = async (embeddingList) => {
    try {
      await saveFaceEmbeddings({ embeddings: embeddingList });
      setSuccess('Face registered successfully! You can now use face recognition for attendance. ✓');
      setRegistered(true);
      setCaptures([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving face data');
    }
  };

  const handleReset = () => {
    setCaptures([]);
    setSuccess('');
    setError('');
    setRegistered(false);
  };

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <div className="page-header">
          <h1>📷 Face Registration</h1>
        </div>

        <div className="card" style={{ maxWidth: 560 }}>
          {registered ? (
            <div>
              <div className="alert alert-success">
                ✅ Your face is registered! You can use face recognition for attendance.
              </div>
              <button className="btn btn-outline" onClick={handleReset}>Re-register Face</button>
            </div>
          ) : (
            <div>
              <p style={{ color: '#555', marginBottom: 16, fontSize: 14 }}>
                We need to capture <strong>3 photos</strong> of your face for recognition.
                Please look directly at the camera in good lighting.
              </p>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
                Progress: <strong>{captures.length}/3 captures</strong>
              </p>

              {!modelsLoaded && (
                <div className="alert alert-error">
                  Loading face recognition models... If this persists, ensure face-api.js model files are in <code>/public/models</code>
                </div>
              )}

              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <div className="webcam-container" style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode }}
                  style={{ width: '100%', maxWidth: 440, aspectRatio: '4 / 3', height: 'auto', borderRadius: 12, display: 'block', margin: '0 auto' }}
                />
                {/* Face guide overlay */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 200, height: 240, border: '3px solid #4facfe',
                  borderRadius: '50% 50% 45% 45%', pointerEvents: 'none'
                }} />
              </div>

              <div className="actions-row">
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={captureEmbedding}
                  disabled={capturing || !modelsLoaded || captures.length >= 3}
                >
                  {capturing ? '📸 Scanning...' : `📷 Capture ${captures.length + 1}/3`}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                  title="Switch camera"
                >
                  🔄
                </button>
                {captures.length > 0 && (
                  <button className="btn btn-outline" onClick={() => setCaptures([])}>Reset</button>
                )}
              </div>

              {captures.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: captures.length > i ? '#22c55e' : '#e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 700, fontSize: 14
                    }}>
                      {captures.length > i ? '✓' : i + 1}
                    </div>
                  ))}
                  <span style={{ fontSize: 13, color: '#888', alignSelf: 'center', marginLeft: 8 }}>
                    {captures.length < 3 ? 'Keep capturing...' : 'Saving...'}
                  </span>
                </div>
              )}

              <div style={{ marginTop: 20, padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: 13, color: '#555' }}>
                <strong>ℹ️ Setup note:</strong> Download face-api.js models from
                <a href="https://github.com/justadudewhohacks/face-api.js/tree/master/weights" target="_blank" rel="noopener noreferrer" style={{ color: '#4facfe' }}>
                  {' '}github.com/justadudewhohacks/face-api.js
                </a> and place them in <code>public/models/</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
