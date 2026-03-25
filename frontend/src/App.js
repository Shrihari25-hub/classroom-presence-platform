import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import TeacherDashboard from './pages/teacher/Dashboard';
import StudentDashboard from './pages/student/Dashboard';
import CoursesPage from './pages/teacher/Courses';
import SubjectsPage from './pages/teacher/Subjects';
import SubjectDetail from './pages/teacher/SubjectDetail';
import EnrollmentsPage from './pages/teacher/Enrollments';
import AttendanceLogs from './pages/teacher/AttendanceLogs';
import TimetablePage from './pages/teacher/Timetable';
import StudentCourses from './pages/student/Courses';
import StudentSubjects from './pages/student/Subjects';
import StudentAttendance from './pages/student/Attendance';
import StudentTimetable from './pages/student/Timetable';
import FaceRegistration from './pages/student/FaceRegistration';
import SessionPage from './pages/teacher/Session';
import TeacherInsights from './pages/teacher/TeacherInsights';

function PrivateRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return <Navigate to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} />;
}


/**
 * Handles the /join/:token path.
 * - If the student is logged in → redirect to /student/subjects passing the token via state.
 * - If not logged in → redirect to /login, then after login the student lands on subjects.
 * This makes the invite link work even for students who aren't already on the subjects page.
 */
function JoinRedirect() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!user) {
      // Save token to sessionStorage so we can pick it up after login
      sessionStorage.setItem('pendingInviteToken', token);
      navigate('/login', { replace: true });
    } else if (user.role === 'student') {
      navigate('/student/subjects', { replace: true, state: { inviteToken: token } });
    } else {
      // Teachers don't join subjects via invite
      navigate('/teacher/dashboard', { replace: true });
    }
  }, [user, token, navigate]);

  return <div style={{ padding: 40, textAlign: 'center' }}>Redirecting…</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Universal invite link — works for any student, logged in or not */}
          <Route path="/join/:token" element={<JoinRedirect />} />

          {/* Teacher routes */}
          <Route path="/teacher/dashboard" element={<PrivateRoute role="teacher"><TeacherDashboard /></PrivateRoute>} />
          <Route path="/teacher/courses" element={<PrivateRoute role="teacher"><CoursesPage /></PrivateRoute>} />
          <Route path="/teacher/subjects" element={<PrivateRoute role="teacher"><SubjectsPage /></PrivateRoute>} />
          <Route path="/teacher/subjects/:subjectId" element={<PrivateRoute role="teacher"><SubjectDetail /></PrivateRoute>} />
          <Route path="/teacher/enrollments/:courseId" element={<PrivateRoute role="teacher"><EnrollmentsPage /></PrivateRoute>} />
          <Route path="/teacher/attendance" element={<PrivateRoute role="teacher"><AttendanceLogs /></PrivateRoute>} />
          <Route path="/teacher/timetable" element={<PrivateRoute role="teacher"><TimetablePage /></PrivateRoute>} />
          <Route path="/teacher/session/:sessionId" element={<PrivateRoute role="teacher"><SessionPage /></PrivateRoute>} />
          <Route path="/teacher/insights" element={<PrivateRoute role="teacher"><TeacherInsights /></PrivateRoute>} />

          {/* Student routes */}
          <Route path="/student/dashboard" element={<PrivateRoute role="student"><StudentDashboard /></PrivateRoute>} />
          <Route path="/student/courses" element={<PrivateRoute role="student"><StudentCourses /></PrivateRoute>} />
          <Route path="/student/subjects" element={<PrivateRoute role="student"><StudentSubjects /></PrivateRoute>} />
          <Route path="/student/attendance" element={<PrivateRoute role="student"><StudentAttendance /></PrivateRoute>} />
          <Route path="/student/timetable" element={<PrivateRoute role="student"><StudentTimetable /></PrivateRoute>} />
          <Route path="/student/face-registration" element={<PrivateRoute role="student"><FaceRegistration /></PrivateRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
