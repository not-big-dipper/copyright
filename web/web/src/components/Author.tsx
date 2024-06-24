import classNames from 'classnames';
import styles from './Author.module.scss';

export const Author = ({
  avatar,
  role,
  name,
  className,
}: {
  avatar?: string;
  role: string;
  name: string;
  className?: string;
}): JSX.Element => {
  return (
    <div className={classNames(styles.author, className)}>
      {avatar && <img src={avatar} alt="avatar" className={styles.avatar} />}
      <div className={styles.nameWrap}>
        <div className={styles.role}>{role}</div>
        <div className={styles.name}>{name}</div>
      </div>
    </div>
  );
};

