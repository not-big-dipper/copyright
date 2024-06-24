import { useEffect, useState, useCallback, useRef, forwardRef } from 'react';
import axios, { AxiosProgressEvent } from 'axios';
import { SERVER_ADDRESS } from '../constants';
import { getId } from '../functions/getId';
import { formatTimeHHMM } from '../functions/formatTimeHHMM';
import dayjs from 'dayjs';
import styles from './TestVideos.module.scss';
import Trash from '../assets/Trash.svg?react';
import Info from '../assets/Info.svg?react';
// import Search from '../assets/Search.svg?react';
import { Author } from '../components/Author';
import { Loader } from '../components/Loader';
import { Dropzone } from '../components/Dropzone';
import { useNavigate } from 'react-router';
import { createSearchParams } from 'react-router-dom';
import { RootPaths } from '.';

export type VideoType = {
  title: string;
  id: string;
  preview?: string;
  publishDate?: string;
  isLoading?: boolean;
  progress?: number;
  estimated?: number;
  abortController?: AbortController; // Add AbortController type
  group: 'index' | 'test';
  isPending?: boolean;
  description?: string;
  error?: boolean;
  checked?: boolean;
};

type ItemType = {
  id: string;
  title: string;
  thumbnail_file: string;
  created: string;
  group: 'test' | 'index';
};

export const TestVideos = (): JSX.Element => {
  const [videoList, setVideoList] = useState<Record<string, VideoType>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const observer = useRef<IntersectionObserver>();
  // const [searchValue, setSearchValue] = useState('');
  // const [debouncedValue, setDebouncedValue] = useState('');
  // const [justValueChanged, setJustValueChanged] = useState(false);

  const fetchVideos = useCallback((page: number) => {
    setLoading(true);
    axios
      .post(
        `${SERVER_ADDRESS}/videos/`,
        {
          page,
          per_page: 30,
          filter: [
            {
              key: 'group',
              value: 'index',
            },
          ],
        },
        {},
      )
      .then((res) => {
        setLoading(false);
        setVideoList((prev) => {
          const newValue = { ...prev };
          res.data?.forEach(
            (item: {
              id: string;
              title: string;
              thumbnail_file: string;
              created: string;
              group: 'index' | 'test';
              description: string;
            }) =>
              (newValue[item.id] = {
                id: item.id,
                title: item.title,
                preview: item.thumbnail_file.replace('pocket_db', 'localhost'),
                publishDate: item.created,
                group: item.group,
                description: item.description,
              }),
          );
          return newValue;
        });
        if (
          res.data?.filter((item: ItemType) => item.group === 'index').length < 30 &&
          res.data.page * res.data.per_page < res.data.total_items
        ) {
          setPage(page + 1);
        } else {
          console.log(res.data?.length);
          if (res.data?.length < 30) {
            setHasMore(false);
          }
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchVideos(page);
  }, [fetchVideos, page]);

  const lastVideoElementRef = useCallback(
    (node: JSX.Element & null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => prevPage + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  const deleteVideo = (video: VideoType): void => {
    if (video.isLoading && video.abortController) {
      video.abortController.abort(); // Abort the upload request if the video is still loading
    }

    setVideoList((prev) => {
      const newValue = { ...prev };
      delete newValue[video.id];
      return newValue;
    });

    axios.delete(`${SERVER_ADDRESS}/video/`, {
      params: {
        video_id: video.id,
      },
    });
  };

  const onVideoUploaded = (video: File): void => {
    const formData = new FormData();
    formData.append('file', video, video.name);
    const id = getId();
    const abortController = new AbortController(); // Create a new AbortController

    setVideoList((prev) => ({
      [id]: {
        title: video.name,
        id,
        isLoading: true,
        progress: 0,
        abortController,
        group: 'index',
      },
      ...prev,
    }));

    axios
      .post(`${SERVER_ADDRESS}/video/`, formData, {
        params: {
          title: video.name,
          description: ' ',
        },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          setVideoList((prev) => ({
            ...prev,
            [id]: {
              ...prev[id],
              progress: progressEvent.progress,
              estimated: progressEvent.estimated,
            },
          }));
        },
        signal: abortController.signal, // Attach the abort signal to the Axios request
      })
      .then((res) => {
        setVideoList((prev) => {
          const newValue = { ...prev };
          const value = newValue[id];
          delete newValue[id];
          newValue[res.data.id] = {
            ...value,
            id: res.data.id,
            publishDate: res.data.created,
            estimated: undefined,
            abortController: undefined,
            description: res.data.description,
          };

          return newValue;
        });

        axios
          .get(`${SERVER_ADDRESS}/video/`, {
            params: {
              video_id: res.data.id,
            },
          })
          .then((res) => {
            setVideoList((prev) => {
              const newValue = { ...prev };
              const value = newValue[res.data.id];
              newValue[res.data.id] = {
                ...value,
                id: res.data.id,
                progress: undefined,
                isLoading: undefined,
                estimated: undefined,
                preview: res.data.thumbnail_file.replace('pocket_db', 'localhost'),
              };

              return newValue;
            });
          });
      });
  };

  const sortedVideoList = Object.values(videoList)
    .filter((video) => video.group === 'index')
    .sort((a, b) => {
      return dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf();
    });

  /* useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(searchValue);
      setJustValueChanged(true);
      setPage(0);
    }, 300);

    // Очистка таймера при изменении value или при размонтировании компонента
    return () => {
      clearTimeout(handler);
    };
  }, [searchValue]); */

  return (
    <div className={styles.page}>
      <div className={styles.title}>База видео</div>
      <div className={styles.pageContent}>
        <Dropzone onVideoUploaded={onVideoUploaded} />
        {/*<div className={styles.searchBar}>
          <Search className={styles.searchIcon} />
          <input
            className={styles.search}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Поиск"
          />
  </div> */}
        {loading && page === 1 ? (
          <Loader />
        ) : (
          <div className={styles.cards}>
            {sortedVideoList?.map((video, index) => (
              <VideoCard
                key={video.id}
                video={video}
                onDelete={() => deleteVideo(video)}
                ref={index > sortedVideoList.length - 10 ? lastVideoElementRef : null}
              />
            ))}
            {loading && <Loader />}
          </div>
        )}
      </div>
    </div>
  );
};

const VideoCard = forwardRef(
  (
    { onDelete, video }: { onDelete: () => void; video: VideoType },
    ref: React.Ref<HTMLDivElement>,
  ): JSX.Element => {
    const navigate = useNavigate();

    const openVideo = (): void => {
      navigate({
        pathname: RootPaths.preview,
        search: createSearchParams({
          video: video.id,
        }).toString(),
      });
    };
    return (
      <div className={styles.card} onClick={openVideo} ref={ref}>
        <div className={styles.videoWrap}>
          {video?.preview ? (
            <img src={video.preview} className={styles.cardPreview} />
          ) : (
            <div className={styles.cardPreview}>
              <Loader />
            </div>
          )}
          {video.progress ? (
            <>
              <div className={styles.progress} style={{ width: video.progress * 100 + '%' }} />
              <div className={styles.progressLine} style={{ width: video.progress * 100 + '%' }} />
            </>
          ) : null}
        </div>
        <div className={styles.cardBlock}>
          <div className={styles.cardTitle}>
            <div>{video.title}</div>
            <Info className={styles.cardInfo} />
            <div className={styles.cardPopup}>{video.description}</div>
          </div>
          {video.isLoading ? (
            <div className={styles.cardInterval}>
              Время загрузки: {formatTimeHHMM(video.estimated || 0)}
            </div>
          ) : null}
          {video.publishDate ? (
            <div className={styles.cardInterval}>
              Добавлено: {dayjs(video.publishDate).add(3, 'hour').format('DD.MM.YYYY HH:mm')}
            </div>
          ) : null}
          <Author
            avatar={
              'https://gravatar.com/avatar/a2823fd105c6e22dd94c96ee53ba86a5?s=400&d=robohash&r=x'
            }
            name={'Сергей Малинин'}
            role={'Модератор'}
            className={styles.cardAuthor}
          />
        </div>
        <div className={styles.trashWrapper} onClick={onDelete}>
          <Trash className={styles.trash} />
        </div>
      </div>
    );
  },
);

VideoCard.displayName = 'VideoCard';

