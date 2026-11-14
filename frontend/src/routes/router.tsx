import { createBrowserRouter } from "react-router-dom";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { ParticipantLayout } from "@/components/participant/ParticipantLayout";
import { AdminAccountPage } from "@/pages/admin/AdminAccountPage";
import { AdminAlbumPage } from "@/pages/admin/AdminAlbumPage";
import { AdminLoginPage } from "@/pages/admin/AdminLoginPage";
import { DashboardPage } from "@/pages/admin/DashboardPage";
import { EventDetailPage } from "@/pages/admin/EventDetailPage";
import { EventFormPage } from "@/pages/admin/EventFormPage";
import { EventParticipantsPage } from "@/pages/admin/EventParticipantsPage";
import { EventPhotosPage } from "@/pages/admin/EventPhotosPage";
import { EventQrPage } from "@/pages/admin/EventQrPage";
import { EventsPage } from "@/pages/admin/EventsPage";
import { AccessCodePage } from "@/pages/public/AccessCodePage";
import { AlbumPage } from "@/pages/public/AlbumPage";
import { EventWelcomePage } from "@/pages/public/EventWelcomePage";
import { GalleryPage } from "@/pages/public/GalleryPage";
import { LandingPage } from "@/pages/public/LandingPage";
import { NotFoundPage } from "@/pages/public/NotFoundPage";
import { ParticipantCameraPage } from "@/pages/public/ParticipantCameraPage";
import { VotingPage } from "@/pages/public/VotingPage";

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: "e/:slug",
        element: <ParticipantLayout />,
        children: [
          {
            index: true,
            element: <EventWelcomePage />,
          },
          {
            path: "a/:code",
            element: <AccessCodePage />,
          },
          {
            path: "camera",
            element: <ParticipantCameraPage />,
          },
          {
            path: "gallery",
            element: <GalleryPage />,
          },
          {
            path: "vote",
            element: <VotingPage />,
          },
        ],
      },
      {
        path: "album/:slug",
        element: <AlbumPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
  {
    path: "/admin/login",
    element: <AdminLoginPage />,
  },
  {
    path: "/admin",
    element: <AdminGuard />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: "events",
            element: <EventsPage />,
          },
          {
            path: "events/new",
            element: <EventFormPage />,
          },
          {
            path: "events/:id",
            element: <EventDetailPage />,
          },
          {
            path: "events/:id/edit",
            element: <EventFormPage />,
          },
          {
            path: "events/:id/participants",
            element: <EventParticipantsPage />,
          },
          {
            path: "events/:id/photos",
            element: <EventPhotosPage />,
          },
          {
            path: "events/:id/album",
            element: <AdminAlbumPage />,
          },
          {
            path: "events/:id/qr",
            element: <EventQrPage />,
          },
          {
            path: "account",
            element: <AdminAccountPage />,
          },
          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
]);
