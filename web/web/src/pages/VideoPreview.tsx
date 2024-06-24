/* eslint-disable @typescript-eslint/no-explicit-any */
import { Player } from '../containers/PlayerContainer/Player';
import styles from './VideoPreview.module.scss';
import { useEffect, useMemo, useState } from 'react';
import { Author } from '../components/Author';
import { Loader } from '../components/Loader';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { SERVER_ADDRESS, WARNING_THREHOLD } from '../constants';
import dayjs from 'dayjs';
import { AxisOptions, Chart } from 'react-charts';
import GetDocument from '../assets/GetDocument.svg?react';

type DailyStars = {
  amount: number;
  time: number;
};

type Series = {
  label: string;
  data: DailyStars[];
};

export const VideoPreview = (): JSX.Element => {
  const [searchParams] = useSearchParams();
  const [videoData, setVideoData] = useState<Record<string, string>>();
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<Series[]>([{ label: 'Violations', data: [] }]);
  const [videoLength, setVideoLength] = useState<number>(0);
  const [videoViolations, setVideoViolations] = useState<Array<any>>();

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${SERVER_ADDRESS}/video/`, {
        params: {
          video_id: searchParams.get('video'),
        },
      })
      .then((res) => {
        console.log(res.data);
        setVideoData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    axios
      .get(`${SERVER_ADDRESS}/violations/`, {
        params: {
          source_video_id: searchParams.get('video'),
        },
      })
      .then((res) => {
        setVideoViolations(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [searchParams]);

  const primaryAxis = useMemo(
    (): AxisOptions<DailyStars> => ({
      getValue: (datum) => datum?.time,
      scaleType: 'linear',
      formatters: {
        scale: (value) => (value === 0 ? 't, с' : value?.toString()),
      },
    }),
    [],
  );

  const secondaryAxes = useMemo(
    (): AxisOptions<DailyStars>[] => [
      {
        getValue: (datum) => datum?.amount,
        scaleType: 'linear',
        max: 10,
        formatters: {
          scale: (value) => value?.toFixed(),
        },
      },
    ],
    [],
  );

  const timeStamp = videoLength / 20;

  useEffect(() => {
    if (videoLength && videoViolations?.length) {
      const timeData: DailyStars[] = [];
      const timeData2: DailyStars[] = [];

      for (let i = 0; i <= videoLength; i += timeStamp) {
        timeData.push({
          time: i,
          amount: 0,
        });
        timeData2.push({
          time: i,
          amount: 0,
        });
      }


      const newData: Series[] = [
        {
          label: 'Ошибки',
          data: timeData,
        },
        {
          label: 'Возможные ошибки',
          data: timeData2,
        },
      ];

      videoViolations.forEach((elem) => {
        const start = Math.floor(elem.start / timeStamp);
        const end = Math.ceil(elem.end / timeStamp);
        console.log(elem.marked_hard)
        const index = elem.marked_hard ? 0 : 1;
        console.log(index, videoViolations);

        for (let i = start; i < end; i++) {
          if (newData[index]?.data?.[i]) {
            newData[index].data[i].amount += 1;
          }
        }
      });

      console.log(newData);

      setChartData(newData);
    }
  }, [videoLength, videoViolations]);

  const onVideoLoaded = (data: Record<string, string | number>): void => {
    setVideoLength(data.length as number);
  };

  const getSlepok = (): void => {
    axios
      .get(`${SERVER_ADDRESS}/embeddings`, {
        params: {
          video_id: searchParams.get('video'),
        },
      })
      .then((res) => {
        console.log(res);
        const jsonString = JSON.stringify(res.data, null, 2);

        // Создание файла
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        // Создание ссылки и клика по ней для скачивания файла
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.json';
        document.body.appendChild(a);
        a.click();

        // Удаление ссылки и освобождение объекта URL
        a.remove();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className={styles.page}>
      <div className={styles.title}>
        Просмотр видео
        {videoData?.title ? (
          <div className={styles.titleBtns}>
            <div className={styles.titleBtn} onClick={getSlepok}>
              <GetDocument className={styles.titleImg} />
              Получить слепок
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.pageContent}>
        {loading ? (
          <Loader />
        ) : (
          videoData?.title && (
            <>
              <div className={styles.playerWrapper}>
                <Player
                  url={videoData.video_file}
                  poster={videoData.thumbnail_file}
                  className={styles.player}
                  onVideoLoaded={onVideoLoaded}
                />
                <div className={styles.videoInfo}>
                  <div className={styles.videoHeader}>
                    <div className={styles.videoTitle}>
                      <div className={styles.videoTitleText}>{videoData.title}</div>
                      <div className={styles.videoTitleDate}>
                        Добавлено: {dayjs(videoData.created).format('DD.MM.YYYY HH:mm')}
                      </div>
                    </div>
                    <Author
                      role="Модератор"
                      name="Сергей Малинин"
                      avatar="https://robohash.org/d7475433421db1ef8e63dd8e50dd64a4?set=set4&bgset=&size=400x400"
                    />
                  </div>
                  <div className={styles.videoDescription}>{videoData.description}</div>
                </div>
              </div>
              <div className={styles.report}>
                <div className={styles.statsTitle}>Статистика</div>
                <div className={styles.statsSubtitle}>
                  Количество видео, использующие фрагменты данного, в зависимости от момента
                </div>
                <div className={styles.chartWrapper}>
                  <Chart
                    options={{
                      data: chartData,
                      primaryAxis,
                      secondaryAxes,
                      tooltip: false,
                      getSeriesStyle: (elem) => {
                        return {
                          color: elem?.index === 0 ? '#F32121' : '#EDAB00',
                        };
                      },
                    }}
                  />
                </div>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};

