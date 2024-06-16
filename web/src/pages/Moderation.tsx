import { Dropzone } from '../components/Dropzone';
import styles from './Moderation.module.scss';
import { VideoType } from './TestVideos';
import { Author } from '../components/Author';
import Trash from '../assets/Trash.svg?react';
import Error from '../assets/Error.svg?react';
import Warning from '../assets/Warning.svg?react';
import Download from '../assets/Download.svg?react';
import Ok from '../assets/Ok.svg?react';
import { MouseEvent, useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { getId } from '../functions/getId';
import { useNavigate } from 'react-router';
import { RootPaths } from '.';
import { createSearchParams } from 'react-router-dom';
import axios, { AxiosProgressEvent } from 'axios';
import { SERVER_ADDRESS } from '../constants';
import dayjs from 'dayjs';
import { Loader } from '../components/Loader';
import { formatTimeHHMM } from '../functions/formatTimeHHMM';

type VideoReport = {
  coincidences?: number;
  coincidencesVideo?: number;
  length?: number;
  maxConincidence?: number;
  coincidencePercent?: number;
  status?: string;
};

type ItemType = {
  id: string;
  title: string;
  thumbnail_file: string;
  created: string;
  group: 'test' | 'index';
};

export const Moderation = (): JSX.Element => {
  const [videoList, setVideoList] = useState<Record<string, VideoType & VideoReport>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const observer = useRef<IntersectionObserver>();

  const fetchVideos = useCallback((page: number) => {
    setLoading(true);
    axios
      .get(`${SERVER_ADDRESS}/videos/`, {
        params: {
          page,
          per_page: 30,
          group: 'test',
        },
      })
      .then((res) => {
        setLoading(false);
        setVideoList((prev) => {
          const newValue = { ...prev };
          res.data?.items?.forEach(
            (item: ItemType) =>
              (newValue[item.id] = {
                id: item.id,
                title: item.title,
                preview: item.thumbnail_file.replace('pocket_db', '176.109.105.24'),
                publishDate: item.created,
                group: item.group,
              }),
          );
          return newValue;
        });
        if (
          res.data?.items?.filter((item: ItemType) => item.group === 'test').length < 30 &&
          res.data.page * res.data.per_page < res.data.total_items
        ) {
          setPage(page + 1);
        } else {
          if (res.data?.items?.length < 30) {
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

  const deleteVideo = (e: MouseEvent, id: string): void => {
    e.stopPropagation();
    const video = videoList[id];
    if (video.isLoading && video.abortController) {
      video.abortController.abort(); // Abort the upload request if the video is still loading
    }
    setVideoList((prev) => {
      const newValue = { ...prev };
      delete newValue[id];
      return newValue;
    });
    axios.delete(`${SERVER_ADDRESS}/video/`, {
      params: {
        video_id: id,
      },
    });
  };

  const onVideoUploaded = (video: File): void => {
    const id = getId();
    const abortController = new AbortController(); // Create a new AbortController
    setVideoList((prev) => ({
      [id]: {
        title: video.name,
        id,
        isLoading: true,
        progress: 0,
        abortController,
        group: 'test',
      },
      ...prev,
    }));
    const formData = new FormData();
    formData.append('file', video, video.name);

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
                estimated: undefined,
                isLoading: false,
                isPending: true,
                preview: res.data.thumbnail_file.replace('pocket_db', '176.109.105.24'),
              };
              return newValue;
            });

            axios
              .post(
                `${SERVER_ADDRESS}/index/`,
                {},
                {
                  params: {
                    video_id: res.data.id,
                  },
                },
              )
              .then(() => {
                axios
                  .put(
                    `${SERVER_ADDRESS}/video/`,
                    {},
                    {
                      params: {
                        video_id: res.data.id,
                        group: 'test',
                        title: res.data.title,
                        description: res.data.description,
                      },
                    },
                  )
                  .then(() => {
                    axios
                      .post(
                        `${SERVER_ADDRESS}/probe/`,
                        {},
                        {
                          params: {
                            video_id: res.data.id,
                          },
                        },
                      )
                      .then(() => {
                        setVideoList((prev) => {
                          const newValue = { ...prev };
                          const value = newValue[res.data.id];
                          newValue[res.data.id] = {
                            ...value,
                            isLoading: undefined,
                            isPending: undefined,
                          };
                          return newValue;
                        });
                      });
                  });
              });
          });
      });
  };

  const sortedVideoList = Object.values(videoList)
    .filter((video) => video.group === 'test')
    .sort((a, b) => {
      return dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf();
    });

  return (
    <div className={styles.page}>
      <div className={styles.title}>
        Модерация
        <div className={styles.titleBtns}>
          <div className={styles.smallDivider} />
          <div className={styles.titleBtn}>
            <Download className={styles.titleImg} />
            Скачать отчет по видео
          </div>
        </div>
      </div>
      <div className={styles.pageContent}>
        <Dropzone onVideoUploaded={onVideoUploaded} />
        <div className={styles.cards}>
          {sortedVideoList.map((video, index) => (
            <VideoCard
              key={video.id}
              video={video}
              onDelete={(e) => deleteVideo(e, video.id)}
              ref={index > 20 * page ? lastVideoElementRef : null}
            />
          ))}
          {loading && <Loader />}
        </div>
      </div>
    </div>
  );
};

const getColor = (status: string | undefined): string => {
  switch (status) {
    case 'error':
      return '#F32121';
    case 'warning':
      return '#EDAB00';
    case 'ok':
      return '#3CDB2E';
    default:
      return 'black';
  }
};

const getIcon = (status: string | undefined): JSX.Element => {
  switch (status) {
    case 'error':
      return <Error className={styles.cardInfo} />;
    case 'warning':
      return <Warning className={styles.cardInfo} />;
    case 'ok':
      return <Ok className={styles.cardInfo} />;
    default:
      return <></>;
  }
};

const VideoCard = forwardRef(
  (
    {
      onDelete,
      video,
    }: { onDelete: (e: MouseEvent<HTMLElement>) => void; video: VideoType & VideoReport },
    ref: React.Ref<HTMLDivElement>,
  ): JSX.Element => {
    const navigate = useNavigate();

    const openVideo = (): void => {
      navigate({
        pathname: RootPaths.report,
        search: createSearchParams({
          video: video.id,
        }).toString(),
      });
    };

    return (
      <div className={styles.card} onClick={openVideo} ref={ref}>
        <div className={styles.leftBlock}>
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
                <div
                  className={styles.progressLine}
                  style={{ width: video.progress * 100 + '%' }}
                />
              </>
            ) : null}
          </div>
          <Author
            avatar={
              'https://gravatar.com/avatar/a2823fd105c6e22dd94c96ee53ba86a5?s=400&d=robohash&r=x'
            }
            name={'Сергей Малинин'}
            role={'Модератор'}
            className={styles.cardAuthor}
          />
        </div>
        <div className={styles.cardBlock}>
          <div className={styles.cardTitle}>
            <div className={styles.cardTitleText} style={{ color: getColor(video.status) }}>
              {video.title}
            </div>
            {getIcon(video.status)}
          </div>
          {video.status ? (
            <div className={styles.cardStats}>
              <div className={styles.cardStat}>
                Найдено совпадений: <span className={styles.statValue}>{video.coincidences}</span>{' '}
                <span className={styles.statNote}>(с {video.coincidencesVideo} видео)</span>
              </div>
              <div className={styles.cardStat}>
                Длительность совпадений:{' '}
                <span className={styles.statValue}>{video.length} сек</span>
              </div>
              <div className={styles.cardStat}>
                Максимальное совпадение:{' '}
                <span className={styles.statValue}>{video.maxConincidence} сек</span>
              </div>
              <div className={styles.cardStat}>
                Процент заимствования:{' '}
                <span className={styles.statValue}>{video.coincidencePercent}%</span>
              </div>
            </div>
          ) : video.isLoading ? (
            <div className={styles.cardInterval}>
              Время загрузки: {formatTimeHHMM(video.estimated || 0)}
            </div>
          ) : video.isPending ? (
            <div className={styles.cardInterval}>
              Идет обработка. Пожалуйста, не закрывайте страницу. Это может занять несколько минут.
            </div>
          ) : video.publishDate ? (
            <div className={styles.cardInterval}>
              Добавлено: {dayjs(video.publishDate).add(3, 'hour').format('DD.MM.YYYY HH:mm')}
            </div>
          ) : null}
        </div>
        <div className={styles.trashWrapper} onClick={onDelete}>
          <Trash className={styles.trash} />
        </div>
      </div>
    );
  },
);

