import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { RootPaths } from '../pages';

export const ErrorPage = (): JSX.Element => {
  const navigate = useNavigate();

  useEffect(() => navigate(RootPaths.base), []);
  return <h1>Page Not Found 404</h1>;
};

