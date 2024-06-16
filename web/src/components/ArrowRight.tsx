import classNames from 'classnames';
import styles from './ArrowRight.module.scss';
import Arrow from '../assets/ArrowRight.svg?react';

export const ArrowRight = ({
  disabled = false,
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

