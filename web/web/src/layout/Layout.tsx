import { Outlet } from 'react-router';
import { Header } from './Header';
import styles from './Layout.module.scss';
import { Menu } from './Menu';

export const Layout = (): JSX.Element => {
  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.layoutContent}>
        <Menu />
        <Outlet />
      </div>
    </div>
  );
};

