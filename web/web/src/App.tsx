import { RouterProvider } from 'react-router';
import { router } from './pages';
import { useEffect } from 'react';
import axios from 'axios';
import { SERVER_ADDRESS } from './constants';

export const App = (): JSX.Element => {
  useEffect(() => {
    if (!localStorage.getItem('session'))
      axios.post(`${SERVER_ADDRESS}/new_moderation_session/`).then((res) => {
        localStorage.setItem('session', res.data.id);
      });
  }, []);

  return <RouterProvider router={router} />;
};

