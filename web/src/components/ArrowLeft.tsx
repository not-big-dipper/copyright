import classNames from 'classnames';
import styles from './ArrowLeft.module.scss';
import Arrow from '../assets/ArrowLeft.svg?react';

export const ArrowLeft = ({
  disabled,
  className,
  onClick,
}: {
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}): JSX.Element => {
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={classNames(styles.infoArrowWrap, disabled && styles.infoArrowWrapDisabled)}
    >
      <Arrow
        className={classNames(
          className,
          styles.infoArrow,
          !disabled ? styles.infoArrowActive : styles.infoArrowDisabled,
        )}
      />
    </div>
  );
};

