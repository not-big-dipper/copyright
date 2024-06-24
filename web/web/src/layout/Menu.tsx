import styles from './Menu.module.scss';
import Analytics from '../assets/Analytics.svg?react';
import ChannelSettings from '../assets/ChannelSettings.svg?react';
import Coin from '../assets/Coin.svg?react';
import Comments from '../assets/Comments.svg?react';
import Playlists from '../assets/Playlists.svg?react';
import Moderation from '../assets/Moderation.svg?react';
import TestVideo from '../assets/TestVideo.svg?react';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { RootPaths } from '../pages';

type MenuItem = {
  label: string;
  path?: string;
  image: JSX.Element;
  disabled?: true;
};

const menuItems: MenuItem[] = [
  {
    label: 'Аналитика',
    disabled: true,
    image: <Analytics />,
  },
  {
    label: 'База видео',
    path: '/base',
    image: <TestVideo />,
  },
  {
    label: 'Модерация',
    path: '/moderation',
    image: <Moderation />,
  },
  {
    label: 'Плейлисты',
    disabled: true,
    image: <Playlists />,
  },
  {
    label: 'Монетизация',
    disabled: true,
    image: <Coin />,
  },
  {
    label: 'Комментарии',
    disabled: true,
    image: <Comments />,
  },
  {
    label: 'Настройка канала',
    disabled: true,
    image: <ChannelSettings />,
  },
];

export const Menu = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();

  const getDefaultItem = (): string => {
    console.log(location.pathname);
    switch (location.pathname) {
      case RootPaths.preview:
        return RootPaths.base;
      case RootPaths.report:
        return RootPaths.moderation;
      default:
        return location.pathname;
    }
  };

  const [selectedItem, setSelectedItem] = useState<string | undefined>(getDefaultItem());

  const onMenuItemChange = (item: MenuItem): void => {
    if (!item.disabled) {
      setSelectedItem(item.path);
      navigate(item.path || '');
    }
  };

  useEffect(() => {
    if (location.pathname === RootPaths.root) {
      navigate(RootPaths.base);
    }
  }, []);

  return (
    <div className={styles.menu}>
      <div className={styles.menuList}>
        {menuItems.map((item) => (
          <div
            className={classNames(
              styles.menuItem,
              item.disabled && styles.menuItemDisabled,
              selectedItem === item.path && styles.menuItemSelected,
            )}
            key={item.label}
            onClick={() => onMenuItemChange(item)}
          >
            {item.image}
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
};

