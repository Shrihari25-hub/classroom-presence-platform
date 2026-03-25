# Adversary-Resilient Classroom Presence Verification Platform

A full-stack MERN application for multi-tenant classroom attendance verification with face recognition, QR fallback, and manual marking.

---

## 🗂️ Project Structure

```
classroom-app/
├── backend/
│   ├── config/          # DB connection
│   ├── controllers/     # Business logic
│   ├── middleware/      # Auth, course access
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API endpoints
│   ├── seed.js          # Sample data
│   ├── server.js        # Entry point
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── public/
    │   └── models/      # face-api.js model files (download separately)
    ├── src/
    │   ├── components/shared/
    │   │   └── Sidebar.js
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── pages/
    │   │   ├── Login.js
    │   │   ├── Register.js
    │   │   ├── teacher/   # Teacher pages
    │   │   └── student/   # Student pages
    │   ├── services/
    │   │   └── api.js     # Axios API calls
    │   ├── App.js
    │   └── index.css
    └── package.json
```

---

## 🚀 Setup Instructions

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm install
npm run dev
```

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm start
```

### 3. Seed Sample Data (Optional)

```bash
cd backend
node seed.js
```

This creates:
- Teacher: `teacher@example.com` / `password123`
- Students: `student1@example.com`, `student2@example.com`, `student3@example.com` (all: `password123`)
- Course ID: `CS101-2024`

### 4. face-api.js Models

Download model weights from:
https://github.com/justadudewhohacks/face-api.js/tree/master/weights

Required files:
- `ssd_mobilenetv1_model-weights_manifest.json` + shard files
- `face_landmark_68_model-weights_manifest.json` + shard files
- `face_recognition_model-weights_manifest.json` + shard files

Place all files in: `frontend/public/models/`

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/face-embeddings | Save face embeddings (student) |

### Courses (Teacher)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/courses | Create course |
| GET | /api/courses/my | Get my courses |
| DELETE | /api/courses/:courseId | Delete course (owner only) |
| POST | /api/courses/:courseId/co-teachers | Add co-teacher |

### Enrollments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/enrollments/request | Student: request to join course |
| GET | /api/enrollments/my | Student: my enrollments |
| GET | /api/enrollments/course/:courseId/pending | Teacher: pending requests |
| PUT | /api/enrollments/:id/review | Teacher: approve/reject |

### Subjects
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/subjects | Create subject |
| GET | /api/subjects/my | Teacher: my subjects |
| POST | /api/subjects/:id/regenerate-invite | Regenerate invite token |

### Subject Enrollments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/subject-enrollments/join | Student: join via invite token |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/sessions/start | Start attendance session |
| PUT | /api/sessions/:id/end | End session |
| GET | /api/sessions/active | Get active sessions |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/attendance/face | Mark via face recognition |
| POST | /api/attendance/qr | Mark via QR token |
| POST | /api/attendance/manual | Teacher: manual mark |
| GET | /api/attendance/my | Student: own logs |
| GET | /api/attendance/logs | Teacher: all logs with filters |
| GET | /api/attendance/embeddings/:subjectId | Get student embeddings for subject |

### Timetable
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/timetable | Create schedule |
| PUT | /api/timetable/:id | Update schedule |
| PUT | /api/timetable/:id/cancel | Cancel class |
| GET | /api/timetable/my | Student: my schedule |
| GET | /api/timetable/course/:courseId | Course schedule |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/export/students/:courseId | Export student list (.xlsx) |
| GET | /api/export/attendance/:subjectId | Export attendance (.xlsx) |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard/teacher | Teacher stats |
| GET | /api/dashboard/student | Student stats |

---

## 🔐 Security

- All API routes (except /auth/register, /auth/login) require JWT
- Course-level data isolation enforced in all queries
- Role-based middleware: `requireTeacher`, `requireStudent`
- Duplicate attendance prevention via unique index on (session, student)
- Session lock: editable for 7 days after end, then permanently locked
- Face embeddings stored separately; raw images never stored in DB

---

## 🧪 Sample API Calls

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@test.com","password":"pass123","role":"teacher"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.com","password":"password123"}'

# Create course (with JWT)
curl -X POST http://localhost:5000/api/courses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseName":"Math 101","courseId":"MATH101-2024"}'

# Student: request enrollment
curl -X POST http://localhost:5000/api/enrollments/request \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId":"MATH101-2024"}'

# Start attendance session
curl -X POST http://localhost:5000/api/sessions/start \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subjectId":"SUBJECT_OBJECT_ID","mode":"face"}'
```

---

## 🎨 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, React Router 6, Context API |
| Styling | Custom CSS (no framework) |
| Face Recognition | face-api.js (browser-side) |
| QR Code | qrcode.react |
| Webcam | react-webcam |
| Backend | Node.js, Express 4 |
| Database | MongoDB with Mongoose |
| Auth | JWT + bcryptjs |
| Export | xlsx library |
