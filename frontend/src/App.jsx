import { Box } from '@chakra-ui/react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CreateEvent from './pages/CreateEvent';
import HomePage from './pages/HomePage';
import AdminHomePage from './pages/AdminHomePage';
import OrganizerHome from './pages/OrganizerHomePage';
import RegisterPage from './pages/RegisterPage';
import OrganizerRegisterPage from './pages/OrganizerRegisterPage';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Navbar';
import ManageOrganizers from './pages/ManageOrganizers';
import CreateRegistrationForm from './pages/CreateRegistrationForm';
import CreateItems from './pages/CreateItems';
import EventInfo from './pages/EventInfo';
import BrowseEvents from './pages/BrowseEvents';
import ParticipantEventInfo from './pages/ParticipantEventInfo';
import RegisterEvent from './pages/RegisterEvent';
import ParticipantProfile from './pages/ParticipantProfile';
import ChangePassword from './pages/ChangePassword';
import SelectInterests from './pages/SelectInterests';
import FollowOrganizations from './pages/FollowOrganizations';
import OrganizerProfile from './pages/OrganizerProfile';
import PasswordResetRequests from './pages/PasswordResetRequests';
import ParticipantOrganizers from './pages/ParticipantOrganizers';
import ParticipantOrganizerDetail from './pages/ParticipantOrganizerDetail';
import UploadPaymentProof from './pages/UploadPaymentProof';
import UploadMerchPaymentProof from './pages/UploadMerchPaymentProof';
import UploadTeamPaymentProof from './pages/UploadTeamPaymentProof';
import JoinTeamEvent from './pages/JoinTeamEvent';
import ParticipantTeamEventDetail from './pages/ParticipantTeamEventDetail';
import TeamChat from './pages/TeamChat';
import TeamChatNotifier from './components/TeamChatNotifier';
import { useAuth } from './context/AuthContext.jsx';

const roleHomePath = {
  Admin: '/admin',
  Organizer: '/organizer',
  Participant: '/',
};

function ProtectedRoute({ allowedRole, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== allowedRole) {
    return <Navigate to={roleHomePath[user.role] || '/'} replace />;
  }

  return children;
}

function App() {

  return (
    <Box minH={"100vh"}>
        <Navbar />
        <TeamChatNotifier />
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/participant/browse-events"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <BrowseEvents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/events/:eventId"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <ParticipantEventInfo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/registerEvent/:eventId"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <RegisterEvent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/events/:eventId/join/:teamCode"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <JoinTeamEvent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/team-events/:eventId"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <ParticipantTeamEventDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/team-events/:eventId/chat/:teamCode"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <TeamChat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/registerEvent/:eventId/payment"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <UploadPaymentProof />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/items/:itemId/payment"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <UploadMerchPaymentProof />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/events/:eventId/team/:teamCode/payment"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <UploadTeamPaymentProof />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/profile"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <ParticipantProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/select-interests"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <SelectInterests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/follow-organizations"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <FollowOrganizations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/change-password"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/organizers"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <ParticipantOrganizers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participant/organizers/:organizerId"
              element={
                <ProtectedRoute allowedRole="Participant">
                  <ParticipantOrganizerDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRole="Admin">
                  <AdminHomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer"
              element={
                <ProtectedRoute allowedRole="Organizer">
                  <OrganizerHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/create"
              element={
                <ProtectedRoute allowedRole="Organizer">
                  <CreateEvent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/profile"
              element={
                <ProtectedRoute allowedRole="Organizer">
                  <OrganizerProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/events/:eventId/registration-form"
              element={
                <ProtectedRoute allowedRole="Organizer">
                  <CreateRegistrationForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/eventInfo/:eventId"
              element={
                <ProtectedRoute allowedRole="Organizer">
                  <EventInfo />
                </ProtectedRoute>
              }
            />
            <Route
                path="/organizer/events/:eventId/items"
                element={
                    <ProtectedRoute allowedRole="Organizer">
                        <CreateItems />
                    </ProtectedRoute>
                }
            />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin/register"
              element={
                <ProtectedRoute allowedRole="Admin">
                  <OrganizerRegisterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/organizers"
              element={
                <ProtectedRoute allowedRole="Admin">
                  <ManageOrganizers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/password-reset-requests"
              element={
                <ProtectedRoute allowedRole="Admin">
                  <PasswordResetRequests />
                </ProtectedRoute>
              }
            />
        </Routes>
    </Box>
  );
}

export default App
