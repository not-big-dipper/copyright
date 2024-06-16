/* eslint-disable @typescript-eslint/no-explicit-any */
import { Interval, Player } from '../containers/PlayerContainer/Player';
import styles from './VideoReport.module.scss';
import { Collapse } from 'react-collapse';
import { useEffect, useState } from 'react';
import Chevron from '../assets/ChevronRight.svg?react';
import Copy from '../assets/Copy.svg?react';
import Download from '../assets/Download.svg?react';
import classNames from 'classnames';
import { copyToClipboard } from '../functions/copyToClipboard';
import { Author } from '../components/Author';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ReactDOMServer from 'react-dom/server';
import { ReportPage } from './ReportPage';
import { Loader } from '../components/Loader';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { SERVER_ADDRESS } from '../constants';
import dayjs from 'dayjs';
import { formatTimeHHMM } from '../functions/formatTimeHHMM';

export const VideoReport = (): JSX.Element => {
  const [searchParams] = useSearchParams();
  const [isGeneralOpen, setIsGeneralOpen] = useState<boolean>(false);
  const [isErrorOpen, setIsErrorOpen] = useState<boolean>(false);
  const showHideAll = isGeneralOpen && isErrorOpen;
  const [videoData, setVideoData] = useState<Record<string, string>>();
  const [loading, setLoading] = useState(false);
  const [probes, setProbes] = useState<Array<Record<string, string | number>>>([]);
  const [videoLength, setVideoLength] = useState(0);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${SERVER_ADDRESS}/video/`, {
        params: {
          video_id: searchParams.get('video'),
        },
      })
      .then((res) => {
        setVideoData(res.data);
        axios
          .get(`${SERVER_ADDRESS}/video_probes/`, {
            params: {
              video_id: searchParams.get('video'),
            },
          })
          .then((res) => {
            setProbes(res.data.violations);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

  const onShowAllClick = (): void => {
    const showOrHide = !showHideAll;
    setIsErrorOpen(showOrHide);
    setIsGeneralOpen(showOrHide);
  };

  const probesLength = probes?.reduce(
    (total, probe) => total + ((probe.end as number) - (probe.start as number)),
    0,
  );
  const plagiatPart = ((probesLength / videoLength) * 100 || 0).toFixed(1);

  const downloadReport = (): void => {
    const htmlString = ReactDOMServer.renderToString(
      <ReportPage
        name={videoData?.title || ''}
        author="Сергей Малинин"
        probes={probes}
        plagiatPart={plagiatPart}
        currentPreview={videoData?.thumbnail_file || ''}
      />,
    );

    // Создаем временный элемент для рендеринга в реальном DOM
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;
    document.body.appendChild(tempDiv);
    const elem: HTMLElement | null = document.querySelector('#report');
    if (elem !== null) {
      const elementWidth = elem.offsetWidth;
      const elementHeight = elem.scrollHeight;
      const pdfWidth = 210; // A4 size in mm
      const pdfHeight = 297; // A4 size in mm
      const ratio = pdfWidth / elementWidth;
      const canvasHeight = elementHeight * ratio;

      html2canvas(elem, { scale: 2 }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');

        let position = 0;
        let heightLeft = canvasHeight;

        while (heightLeft > 0) {
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, elementHeight * ratio);
          heightLeft -= pdfHeight;
          position = -pdfHeight; // перемещаемся на следующую страницу по оси y
          if (heightLeft > 0) {
            pdf.addPage();
          }
        }

        pdf.save(videoData?.title + '.pdf');
      });
    }
    document.body.removeChild(tempDiv);
  };

  const onVideoLoaded = (data: Record<string, string | number>): void => {
    setVideoLength(data.length as number);
  };

  const uniqueVideoIds = new Set();

  probes?.forEach((probe) => {
    uniqueVideoIds.add(probe.video_id);
  });

  const uniqueVideoIdsCount = uniqueVideoIds.size;
  let maxDuration = 0;

  probes?.forEach((probe) => {
    const duration = (probe.end as number) - (probe.start as number);
    if (duration > maxDuration) {
      maxDuration = duration;
    }
  });

  const intervals: Interval[] = probes.map((probe) => ({
    start: probe.start as number,
    duration: (probe.end as number) - (probe.start as number),
    color: '#ff645f',
    type: 'error',
    id: probe.id as string,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.title}>
        Отчет о проверке
        {videoData?.title ? (
          <div className={styles.titleBtns}>
            <div className={styles.smallDivider} />
            <div className={styles.titleBtn} onClick={downloadReport}>
              <Download className={styles.titleImg} />
              Скачать отчет по видео
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
                  intervals={intervals}
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
                <div className={styles.openAll} onClick={onShowAllClick}>
                  {showHideAll ? 'Свернуть' : 'Развернуть'} все
                  <Chevron
                    className={classNames(styles.chevronSmall, showHideAll && styles.chevronDown)}
                  />
                </div>
                <div className={styles.infoWrap}>
                  <div
                    className={styles.infoTitle}
                    onClick={() => setIsGeneralOpen((prev) => !prev)}
                  >
                    Общая информация
                    <Chevron
                      className={classNames(styles.chevronBig, isGeneralOpen && styles.chevronDown)}
                    />
                  </div>
                  <Collapse isOpened={isGeneralOpen} theme={{ collapse: styles.collapse }}>
                    <div className={styles.infoBlock}>
                      <div className={styles.infoLine}>
                        <InfoItem>
                          <div className={styles.simpleCard}>
                            <div className={styles.cardName}>
                              Найдено
                              <br />
                              совпадений
                            </div>
                            <div className={styles.cardValue}>{probes.length}</div>
                          </div>
                        </InfoItem>
                        <InfoItem>
                          <div className={styles.simpleCard}>
                            <div className={styles.cardName}>
                              Длительность
                              <br />
                              совпадений
                            </div>
                            <div className={styles.cardValue}>
                              {probesLength} <span className={styles.cardValueNote}>сек</span>
                            </div>
                          </div>
                        </InfoItem>
                      </div>
                      <div className={styles.infoLine}>
                        <InfoItem>
                          <div>
                            <div>
                              <div className={styles.cardName}>Заимствование</div>
                              <div className={styles.cardValue}>
                                {plagiatPart}
                                <span className={styles.cardValueNote}>%</span>
                              </div>
                            </div>
                          </div>
                        </InfoItem>
                        <InfoItem>
                          <div>
                            <div>
                              <div className={styles.cardName}>
                                Максимальное
                                <br />
                                совпадение
                              </div>
                              <div className={styles.cardValue}>
                                <span className={styles.underline}>{maxDuration}</span>{' '}
                                <span className={styles.cardValueNote}>сек</span>
                              </div>
                            </div>
                          </div>
                        </InfoItem>
                      </div>
                      <div className={styles.infoLine}>
                        <InfoItem>
                          <div className={styles.longCard}>
                            <div className={styles.cardName}>
                              Уникальных
                              <br />
                              заимствующих
                              <br />
                              видео
                            </div>
                            <div className={styles.cardValue}>{uniqueVideoIdsCount}</div>
                            {uniqueVideoIdsCount ? (
                              <>
                                <div className={styles.verticalDivider} />
                                <div className={styles.videoList}>
                                  <a
                                    className={styles.videoItem}
                                    href="https://www.google.com/"
                                    target="_blank"
                                  >
                                    {Object.values(uniqueVideoIds)?.map((elem) => (
                                      <>
                                        {elem}
                                        <Copy
                                          className={styles.copy}
                                          onClick={(e) =>
                                            copyToClipboard(e, 'https://www.google.com/')
                                          }
                                        />
                                      </>
                                    ))}
                                  </a>
                                </div>
                              </>
                            ) : null}
                          </div>
                        </InfoItem>
                      </div>
                    </div>
                  </Collapse>
                  {probes.length ? (
                    <>
                      <div
                        className={styles.infoTitle}
                        onClick={() => setIsErrorOpen((prev) => !prev)}
                      >
                        Найдено нарушение
                        <Chevron
                          className={classNames(
                            styles.chevronBig,
                            isErrorOpen && styles.chevronDown,
                          )}
                        />
                      </div>
                      <Collapse isOpened={isErrorOpen} theme={{ collapse: styles.collapse }}>
                        {probes.map((probe) => (
                          <div className={styles.infoBlock}>
                            <div className={styles.infoLine}>
                              <InfoItem>
                                <div>
                                  <div className={styles.cardFirstLine}>
                                    <div className={styles.cardName}>
                                      Время
                                      <br />
                                      совпадения
                                    </div>
                                    <div className={styles.cardValue}>
                                      {(probe.end as number) - (probe.start as number)}
                                      <span className={styles.cardValueNote}>сек</span>
                                    </div>
                                  </div>
                                  <div className={styles.cardSecondLine}>
                                    <div className={styles.secondLineValue}>
                                      <div className={styles.cardNoteTitle}>Начало</div>
                                      <div className={styles.cardTime}>
                                        {formatTimeHHMM(probe.start as number)}
                                      </div>
                                    </div>
                                    <div className={styles.secondLineValue}>
                                      <div className={styles.cardNoteTitle}>Конец</div>
                                      <div className={styles.cardTime}>
                                        {' '}
                                        {formatTimeHHMM(probe.end as number)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </InfoItem>
                              {/* <InfoItem>
                                <div>
                                  <div className={styles.cardFirstLine}>
                                    <div className={styles.cardName}>
                                      <span className={styles.underline}>
                                        Оригинальное
                                        <br />
                                        видео
                                      </span>
                                    </div>
                                  </div>
                                </div>
                        </InfoItem> */}
                            </div>
                          </div>
                        ))}
                      </Collapse>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
};

export const InfoItem = ({
  children,
  className,
}: {
  children: JSX.Element;
  className?: string;
}): JSX.Element => {
  return <div className={classNames(styles.infoItem, className)}>{children}</div>;
};

