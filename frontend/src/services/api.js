import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const register = (data) => API.post('/auth/register', data);
export const login = (data) => API.post('/auth/login', data);
export const getMe = () => API.get('/auth/me');
export const saveFaceEmbeddings = (data) => API.post('/auth/face-embeddings', data);

// Courses
export const createCourse = (data) => API.post('/courses', data);
export const getMyCourses = () => API.get('/courses/my');
export const getCourse = (courseId) => API.get(`/courses/${courseId}`);
export const updateCourse = (courseId, data) => API.put(`/courses/${courseId}`, data);
export const deleteCourse = (courseId) => API.delete(`/courses/${courseId}`);
export const addCoTeacher = (courseId, data) => API.post(`/courses/${courseId}/co-teachers`, data);

// Enrollments
export const requestEnrollment = (data) => API.post('/enrollments/request', data);
export const getMyEnrollments = () => API.get('/enrollments/my');
export const getPendingRequests = (courseId) => API.get(`/enrollments/course/${courseId}/pending`);
export const getCourseStudents = (courseId) => API.get(`/enrollments/course/${courseId}/students`);
export const reviewEnrollment = (id, action) => API.put(`/enrollments/${id}/review`, { action });

// Subjects
export const createSubject = (data) => API.post('/subjects', data);
export const getMySubjects = () => API.get('/subjects/my');
export const getSubjectsByCourse = (courseId) => API.get(`/subjects/course/${courseId}`);
export const getSubject = (id) => API.get(`/subjects/${id}`);
export const updateSubject = (id, data) => API.put(`/subjects/${id}`, data);
export const deleteSubject = (id) => API.delete(`/subjects/${id}`);
export const regenerateInviteToken = (id) => API.post(`/subjects/${id}/regenerate-invite`);

// Subject Enrollments
export const joinSubject = (data) => API.post('/subject-enrollments/join', data);
export const getMySubjectEnrollments = () => API.get('/subject-enrollments/my');
export const getSubjectStudents = (subjectId) => API.get(`/subject-enrollments/subject/${subjectId}/students`);

// Sessions
export const startSession = (data) => API.post('/sessions/start', data);
export const endSession = (sessionId) => API.put(`/sessions/${sessionId}/end`);
export const getActiveSessions = () => API.get('/sessions/active');
export const getSessionsBySubject = (subjectId) => API.get(`/sessions/subject/${subjectId}`);
export const getSession = (sessionId) => API.get(`/sessions/${sessionId}`);

// Attendance
export const markAttendanceFace = (data) => API.post('/attendance/face', data);
export const markAttendanceQR = (data) => API.post('/attendance/qr', data);
export const markAttendanceManual = (data) => API.post('/attendance/manual', data);
export const getMyAttendanceLogs = (params) => API.get('/attendance/my', { params });
export const getSessionAttendance = (sessionId) => API.get(`/attendance/session/${sessionId}`);
export const getAttendanceLogs = (params) => API.get('/attendance/logs', { params });
export const getSubjectEmbeddings = (subjectId) => API.get(`/attendance/embeddings/${subjectId}`);

// Timetable
export const createSchedule = (data) => API.post('/timetable', data);
export const updateSchedule = (id, data) => API.put(`/timetable/${id}`, data);
export const cancelClass = (id, data) => API.put(`/timetable/${id}/cancel`, data);
export const deleteSchedule = (id) => API.delete(`/timetable/${id}`);
export const getTimetableByCourse = (courseId) => API.get(`/timetable/course/${courseId}`);
export const getMyTimetable = () => API.get('/timetable/my');

// Dashboard
export const getTeacherDashboard = () => API.get('/dashboard/teacher');
export const getStudentDashboard = () => API.get('/dashboard/student');

// Analytics
export const getTeacherReport = () => API.get('/analytics/teacher-report');

// Export (open in new tab)
export const exportStudentList = (courseId) => {
  const token = localStorage.getItem('token');
  window.open(`${process.env.REACT_APP_API_URL || '/api'}/export/students/${courseId}?token=${token}`, '_blank');
};
export const exportAttendance = (subjectId) => {
  const token = localStorage.getItem('token');
  window.open(`${process.env.REACT_APP_API_URL || '/api'}/export/attendance/${subjectId}?token=${token}`, '_blank');
};

export default API;
