import { createBrowserRouter } from 'react-router-dom';
import { TestVideos } from './TestVideos';
import { Moderation } from './Moderation';
import { Layout } from '../layout/Layout';
import { ErrorPage } from '../layout/ErrorPage';
import { VideoReport } from './VideoReport';
import { VideoPreview } from './VideoPreview';

export const RootPaths = {
  root: '/',
  base: '/base',
  moderation: '/moderation',
  report: '/report',
  preview: '/preview',
  check: '/check',
  error: '*',
};

export const router = createBrowserRouter([
  {
    path: RootPaths.root,
    element: <Layout />,
    children: [
      {
        path: RootPaths.base,
        element: <TestVideos />,
      },
      {
        path: RootPaths.moderation,
        element: <Moderation />,
      },
      {
        path: RootPaths.report,
        element: <VideoReport />,
      },
      {
        path: RootPaths.preview,
        element: <VideoPreview />,
      },
    ],
  },
  {
    path: RootPaths.error,
    element: <ErrorPage />,
  },
]);

