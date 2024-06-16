import { RouterProvider } from 'react-router';
import { router } from './pages';

export const App = (): JSX.Element => {
  return <RouterProvider router={router} />;
};

