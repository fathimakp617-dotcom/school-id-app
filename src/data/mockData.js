// User records come from the local SchoolID server; no sample students or events are shown.
export const mockStudents = []
export const mockAttendance = []
export const mockHomework = []
export const mockNotifications = []

export const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const subjectColors = {
  'Mathematics': 'bg-blue-100 text-blue-700',
  'English': 'bg-green-100 text-green-700',
  'Physics': 'bg-purple-100 text-purple-700',
  'Science': 'bg-orange-100 text-orange-700',
  'Chemistry': 'bg-red-100 text-red-700',
  'History': 'bg-yellow-100 text-yellow-700',
  'default': 'bg-gray-100 text-gray-700',
};
