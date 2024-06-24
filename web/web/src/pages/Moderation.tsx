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
import { SERVER_ADDRESS, WARNING_THREHOLD } from '../constants';
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
  percent?: 'warning' | 'error';
};

type ItemType = {
  id: string;
  title: string;
  thumbnail_file: string;
  created: string;
  group: 'test' | 'index';
  checked: boolean;
};

export const Moderation = (): JSX.Element => {
  const [videoList, setVideoList] = useState<Record<string, VideoType & VideoReport>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [is2loading, setIs2Loading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const observer = useRef<IntersectionObserver>();
  const [allViolations, setAllViolations] = useState([]);

  const allViolationsObject = {};
  const uniqueVideoIds = new Set();

  allViolations.forEach((probe) => {
    // @ts-expect-error fine
    uniqueVideoIds.add(probe.source_video.id);
  });

  allViolations?.forEach((elem) => {
    // @ts-expect-error fine
    const diff = elem.end - elem.start;
    // @ts-expect-error fine
    allViolationsObject[elem.violation_video.id] = {
      // @ts-expect-error fine
      ...allViolationsObject[elem.violation_video.id],
      // @ts-expect-error fine
      coincidences: allViolationsObject[elem.violation_video.id]
        ? // @ts-expect-error fine
          allViolationsObject[elem.violation_video.id]?.coincidences + 1
        : 1,
      coincidencesVideo: uniqueVideoIds.size,
      // @ts-expect-error fine
      length: allViolationsObject[elem.violation_video.id]
        ? // @ts-expect-error fine
          allViolationsObject[elem.violation_video.id]?.length + elem.end - elem.start
        : // @ts-expect-error fine
          elem.end - elem.start,
      // @ts-expect-error fine
      maxConincidence: allViolationsObject[elem.violation_video.id]
        ? // @ts-expect-error fine
          allViolationsObject[elem.violation_video.id]?.maxConincidence < diff
          ? diff
          : // @ts-expect-error fine
            allViolationsObject[elem.violation_video.id]?.maxConincidence
        : diff,
      percent:
        // @ts-expect-error fine
        allViolationsObject[elem.violation_video.id] &&
        // @ts-expect-error fine
        allViolationsObject[elem.violation_video.id]?.percent === 'error' ? 'error' : (elem.marked_hard ? 'error': 'warning'),
    };
  });

  useEffect(() => {
    setIs2Loading(true);
    axios
      .get(`${SERVER_ADDRESS}/all_violations/`, {
        params: {
          moderation_session_id: localStorage.getItem('session'),
        },
      })
      .then((res) => {
        setIs2Loading(false);
        setAllViolations(res.data);
      });
  }, []);

  const fetchVideos = useCallback((page: number) => {
    setLoading(true);
    axios
      .post(`${SERVER_ADDRESS}/videos/`, {
        page,
        per_page: 30,
        filter: [
          {
            key: 'group',
            value: 'test',
          },
        ],
      })
      .then((res) => {
        setLoading(false);
        setVideoList((prev) => {
          const newValue = { ...prev };
          res.data?.forEach(
            (item: ItemType) =>
              (newValue[item.id] = {
                id: item.id,
                title: item.title,
                preview: item.thumbnail_file.replace('pocket_db', 'localhost'),
                publishDate: item.created,
                group: item.group,
                checked: item.checked,
              }),
          );
          return newValue;
        });
        if (
          res.data?.filter((item: ItemType) => item.group === 'test').length < 30 &&
          res.data.page * res.data.per_page < res.data.total_items
        ) {
          setPage(page + 1);
        } else {
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

  const addToBase = (e: MouseEvent<HTMLElement>, id: string): void => {
    e.stopPropagation();
    axios
      .put(`${SERVER_ADDRESS}/video/`, {
        group: 'index',
        video_id: id,
      })
      .then(() => {
        setVideoList((prev) => {
          const newItems = { ...prev };
          delete newItems[id];
          return newItems;
        });
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
          group: 'test',
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
                preview: res.data.thumbnail_file.replace('pocket_db', 'localhost'),
              };
              return newValue;
            });

            axios
              .post(
                `${SERVER_ADDRESS}/run_index/`,
                {},
                {
                  params: {
                    video_id: res.data.id,
                  },
                },
              )
              .then(() => {
                axios
                  .put(`${SERVER_ADDRESS}/video/`, {
                    video_id: res.data.id,
                    group: 'test',
                    title: res.data.title,
                    description: res.data.description,
                  })
                  .then(() => {
                    axios
                      .post(
                        `${SERVER_ADDRESS}/run_check/`,
                        {},
                        {
                          params: {
                            video_id: res.data.id,
                            moderation_session_id: localStorage.getItem('session'),
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
                      })
                      .catch(() => {
                        setVideoList((prev) => {
                          const newValue = { ...prev };
                          const value = newValue[res.data.id];
                          newValue[res.data.id] = {
                            ...value,
                            isLoading: undefined,
                            isPending: undefined,
                            error: true,
                          };
                          return newValue;
                        });
                      });
                  })
                  .catch(() => {
                    setVideoList((prev) => {
                      const newValue = { ...prev };
                      const value = newValue[res.data.id];
                      newValue[res.data.id] = {
                        ...value,
                        isLoading: undefined,
                        isPending: undefined,
                        error: true,
                      };
                      return newValue;
                    });
                  });
              })
              .catch(() => {
                setVideoList((prev) => {
                  const newValue = { ...prev };
                  const value = newValue[res.data.id];
                  newValue[res.data.id] = {
                    ...value,
                    isLoading: undefined,
                    isPending: undefined,
                    error: true,
                  };
                  return newValue;
                });
              });
          })
          .catch(() => {
            setVideoList((prev) => {
              const newValue = { ...prev };
              const value = newValue[res.data.id];
              newValue[res.data.id] = {
                ...value,
                isLoading: undefined,
                isPending: undefined,
                error: true,
              };
              return newValue;
            });
          });
      });
  };

  const sortedVideoList = Object.values(videoList)
    .filter((video) => video.group === 'test')
    .sort((a, b) => {
      return dayjs(b.publishDate).valueOf() - dayjs(a.publishDate).valueOf();
    });

  const downloadCSV = (): void => {
    axios
      .get(`${SERVER_ADDRESS}/csv_report/`, {
        params: {
          moderation_session_id: localStorage.getItem('session'),
        },
      })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'report.csv'; // указываем имя файла
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      });
  };

  const [sessionId, setSessionId] = useState(localStorage.getItem('session'));

  const endModeration = (): void => {
    axios.post(`${SERVER_ADDRESS}/new_moderation_session/`).then((res) => {
      localStorage.setItem('session', res.data.id);
      setSessionId(res.data.id);
    });
  };

  console.log(videoList);

  return (
    <div className={styles.page}>
      <div className={styles.title}>
        Модерация
        <span className={styles.titleId}>{sessionId}</span>
        <div className={styles.titleBtns}>
          <div className={styles.smallDivider} />
          <div className={styles.titleBtn} onClick={downloadCSV}>
            <Download className={styles.titleImg} />
            Скачать отчет
          </div>
          <div className={styles.endModeration} onClick={endModeration}>
            Завершить модерацию
          </div>
        </div>
      </div>
      <div className={styles.pageContent}>
        <Dropzone onVideoUploaded={onVideoUploaded} />
        <div className={styles.cards}>
          {!is2loading &&
            sortedVideoList.map((video, index) => (
              <VideoCard
                key={video.id}
                video={video}
                onDelete={(e) => deleteVideo(e, video.id)}
                // @ts-expect-error fine
                violations={allViolationsObject[video.id]}
                ref={index > 20 * page ? lastVideoElementRef : null}
                addToBase={(e) => addToBase(e, video.id)}
              />
            ))}
          {(loading || is2loading) && <Loader />}
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
      violations,
      addToBase,
    }: {
      onDelete: (e: MouseEvent<HTMLElement>) => void;
      video: VideoType;
      violations: VideoReport;
      addToBase: (e: MouseEvent<HTMLElement>) => void;
    },
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

    const status = violations?.percent ?? ((violations?.coincidences) ? (violations.coincidences > 0 ? 'error' : 'ok') : undefined);

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
            <div
              className={styles.cardTitleText}
              style={video.checked ? { color: getColor(status) } : {}}
            >
              {video.title}
            </div>
            {video.checked && getIcon(status)}
          </div>
          {video.checked ? (
            <div className={styles.cardStats}>
              <div className={styles.cardStat}>
                Найдено совпадений:{' '}
                <span className={styles.statValue}>{violations?.coincidences || 0}</span>{' '}
                {violations?.coincidencesVideo && (
                  <span className={styles.statNote}>(с {violations?.coincidencesVideo} видео)</span>
                )}
              </div>
              {violations?.coincidences && (
                <>
                  <div className={styles.cardStat}>
                    Длительность совпадений:{' '}
                    <span className={styles.statValue}>{violations?.length} сек</span>
                  </div>
                  <div className={styles.cardStat}>
                    Максимальное совпадение:{' '}
                    <span className={styles.statValue}>{violations?.maxConincidence} сек</span>
                  </div>
                </>
              )}
            </div>
          ) : video.isLoading ? (
            <div className={styles.cardInterval}>
              Время загрузки: {formatTimeHHMM(video.estimated || 0)}
            </div>
          ) : video.isPending ? (
            <div className={styles.cardInterval}>
              Идет обработка. Пожалуйста, не закрывайте страницу. Это может занять несколько минут.
            </div>
          ) : video.error ? (
            <div className={styles.cardInterval}>Ошибка. Пожалуйста, попробуйте еще раз.</div>
          ) : video.publishDate ? (
            <div className={styles.cardInterval}>
              Добавлено: {dayjs(video.publishDate).add(3, 'hour').format('DD.MM.YYYY HH:mm')}
            </div>
          ) : null}
          {video?.checked && !violations?.length && (
            <div className={styles.addToBase} onClick={addToBase}>
              Добавить в базу
            </div>
          )}
        </div>
        <div className={styles.trashWrapper} onClick={onDelete}>
          <Trash className={styles.trash} />
        </div>
      </div>
    );
  },
);

