import Rutube from '../assets/Rutube.svg?react';
import styles from './Header.module.scss';
import Profile from '../assets/Profile.svg?react';

export const Header = (): JSX.Element => {
  return (
    <div className={styles.header}>
      <Rutube className={styles.rutube} />
      <Profile className={styles.profile} />
    </div>
  );
};

